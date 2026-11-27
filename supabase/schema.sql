-- PanigaCraftz database schema.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query),
-- then run supabase/seed.sql to load the products. Safe to run again: it only
-- creates what is missing and replaces the functions.
--
-- The rules here match src/lib/rules.js, so the database enforces them even if a
-- request skips the website. Requirement ids refer to docs/requirements.md.

-- ---------- products and inventory ----------
create table if not exists products (
  id                          text primary key,
  slug                        text unique not null,                   -- web address: /products/<slug>/
  category                    text not null,
  hamper_type                 text,
  name                        text not null,
  description                 text not null default '',
  price_cents                 integer check (price_cents is null or price_cents >= 0),  -- null = price on enquiry
  price_from                  boolean not null default false,
  status                      text check (status in ('in', 'made', 'sold')),           -- null = follow stock
  -- REQ-P1, REQ-P2: personalisation flag and per-product word limit
  personalisable              boolean not null default false,
  personalisation_label       text,
  personalisation_word_limit  integer check (personalisation_word_limit between 1 and 200),
  -- REQ-H1, REQ-H2: inventory and hamper eligibility
  stock_qty                   integer check (stock_qty is null or stock_qty >= 0),      -- null = not counted
  hamper_eligible             boolean not null default false,
  is_hamper_builder           boolean not null default false,
  -- Display details that don't need rules of their own (photos, badge, size,
  -- occasions, festivals, Instagram post, placeholder colours, "sample" flag).
  details                     jsonb not null default '{}'::jsonb,
  sort_added                  integer not null default 0,              -- higher = newer ("Recent products")
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint personalisation_needs_limit
    check (not personalisable or personalisation_word_limit is not null),
  constraint hamper_piece_needs_stock_count
    check (not hamper_eligible or stock_qty is not null)
);

-- Same word rule as wordCount() in src/lib/rules.js: runs of non-space characters.
create or replace function pc_word_count(t text) returns integer
language sql immutable as $$
  select case when t is null or btrim(t) = '' then 0
              else coalesce(array_length(regexp_split_to_array(btrim(t), '\s+'), 1), 0) end
$$;

-- ---------- enquiries (orders before Stripe) ----------
create table if not exists enquiries (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,
  customer_name text not null check (char_length(btrim(customer_name)) >= 2),
  email         text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  phone         text,
  postcode      text check (postcode ~ '^\d{4}$'),
  status        text not null default 'new' check (status in ('new', 'confirmed', 'cancelled', 'fulfilled')),
  created_at    timestamptz not null default now()
);

create table if not exists enquiry_items (
  id                    uuid primary key default gen_random_uuid(),
  enquiry_id            uuid not null references enquiries(id) on delete cascade,
  product_id            text not null references products(id),
  qty                   integer not null check (qty between 1 and 500),
  personalisation_text  text,
  packaging             text,
  gift_note             text check (gift_note is null or char_length(gift_note) <= 300)
);

-- REQ-P3, REQ-P4: personalisation only on personalisable products, within the word limit.
create or replace function enquiry_items_check_personalisation() returns trigger
language plpgsql as $$
declare p products;
begin
  if pc_word_count(new.personalisation_text) = 0 then return new; end if;
  select * into p from products where id = new.product_id;
  if not p.personalisable then
    raise exception 'Product % cannot be personalised', new.product_id;
  end if;
  if pc_word_count(new.personalisation_text) > p.personalisation_word_limit then
    raise exception 'Personalisation for % is limited to % words', new.product_id, p.personalisation_word_limit;
  end if;
  return new;
end $$;

drop trigger if exists trg_enquiry_items_personalisation on enquiry_items;
create trigger trg_enquiry_items_personalisation
  before insert or update on enquiry_items
  for each row execute function enquiry_items_check_personalisation();

-- Pieces inside a build-your-own hamper line.
create table if not exists enquiry_hamper_items (
  enquiry_item_id  uuid not null references enquiry_items(id) on delete cascade,
  product_id       text not null references products(id),
  qty              integer not null check (qty >= 1),
  primary key (enquiry_item_id, product_id)
);

-- REQ-H3, REQ-H4: a hamper piece must be eligible and in stock. The stock is held
-- (decremented) in the same statement, so two customers can't take the last unit.
create or replace function enquiry_hamper_items_take_stock() returns trigger
language plpgsql as $$
declare need integer;
begin
  select new.qty * ei.qty into need from enquiry_items ei where ei.id = new.enquiry_item_id;
  update products
     set stock_qty = stock_qty - need, updated_at = now()
   where id = new.product_id and hamper_eligible and active and stock_qty >= need;
  if not found then
    raise exception 'Not enough % in stock for this hamper', new.product_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_enquiry_hamper_items_stock on enquiry_hamper_items;
create trigger trg_enquiry_hamper_items_stock
  before insert on enquiry_hamper_items
  for each row execute function enquiry_hamper_items_take_stock();

-- REQ-H5: cancelling an enquiry gives the held hamper stock back.
create or replace function enquiries_release_stock() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update products p
       set stock_qty = p.stock_qty + x.units, updated_at = now()
      from (select h.product_id, sum(h.qty * ei.qty) as units
              from enquiry_hamper_items h join enquiry_items ei on ei.id = h.enquiry_item_id
             where ei.enquiry_id = new.id group by h.product_id) x
     where p.id = x.product_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_enquiries_release_stock on enquiries;
create trigger trg_enquiries_release_stock
  after update of status on enquiries
  for each row execute function enquiries_release_stock();

-- ---------- submitting an enquiry ----------
-- The website never writes to the tables directly. It calls this one function, which
-- saves the whole enquiry in a single transaction: if any line breaks a rule (word
-- limit, stock, hamper size), nothing is saved and the stock is untouched.
-- payload: { name, email, phone, postcode, lines: [{ id, qty, opts: { text, packaging, note, items: [{ id, qty }] } }] }
create or replace function submit_enquiry(payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  e_id uuid; ei_id uuid; new_ref text; line jsonb; item jsonb; pieces integer; builder boolean;
begin
  if jsonb_array_length(coalesce(payload->'lines', '[]'::jsonb)) = 0 then
    raise exception 'The enquiry has no items';
  end if;
  new_ref := 'PC-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into enquiries (ref, customer_name, email, phone, postcode)
  values (new_ref, payload->>'name', payload->>'email', nullif(payload->>'phone', ''), nullif(payload->>'postcode', ''))
  returning id into e_id;

  for line in select * from jsonb_array_elements(payload->'lines') loop
    select is_hamper_builder into builder from products where id = line->>'id' and active;
    if builder is null then raise exception 'Unknown product %', line->>'id'; end if;
    insert into enquiry_items (enquiry_id, product_id, qty, personalisation_text, packaging, gift_note)
    values (e_id, line->>'id', (line->>'qty')::int, nullif(line->'opts'->>'text', ''),
            line->'opts'->>'packaging', nullif(line->'opts'->>'note', ''))
    returning id into ei_id;

    pieces := 0;
    for item in select * from jsonb_array_elements(coalesce(line->'opts'->'items', '[]'::jsonb)) loop
      insert into enquiry_hamper_items (enquiry_item_id, product_id, qty)
      values (ei_id, item->>'id', (item->>'qty')::int);
      pieces := pieces + (item->>'qty')::int;
    end loop;
    -- REQ-H6: a build-your-own hamper has 2 to 8 pieces; other products have none.
    if builder and (pieces < 2 or pieces > 8) then raise exception 'A hamper needs 2 to 8 pieces'; end if;
    if not builder and pieces > 0 then raise exception 'Only the build-your-own hamper can hold pieces'; end if;
  end loop;
  return new_ref;
end $$;

-- ---------- access ----------
-- Visitors (the "anon" key used by the website) can read active products and call
-- submit_enquiry. Nothing else. Enquiries are only visible to Neha (admin, next step).
alter table products enable row level security;
alter table enquiries enable row level security;
alter table enquiry_items enable row level security;
alter table enquiry_hamper_items enable row level security;
drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select using (active);
revoke all on function submit_enquiry(jsonb) from public;
grant execute on function submit_enquiry(jsonb) to anon, authenticated;
