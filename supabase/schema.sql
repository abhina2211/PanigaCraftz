-- PanigaCraftz database schema (DRAFT, not yet applied to any Supabase project).
-- Mirrors the rules in js/rules.js so the database enforces them too, even if a
-- request skips the website. Requirement ids refer to docs/requirements.md.
--
-- Apply with the Supabase SQL editor or `supabase db push` once the project exists.

-- ---------- products and inventory ----------
create table if not exists products (
  id                          text primary key,
  category                    text not null,
  hamper_type                 text,
  name                        text not null,
  description                 text not null default '',
  price_cents                 integer check (price_cents is null or price_cents >= 0),  -- null = price on enquiry
  price_from                  boolean not null default false,
  status                      text check (status in ('in', 'made', 'sold')),
  -- REQ-P1, REQ-P2: personalisation flag and per-product word limit
  personalisable              boolean not null default false,
  personalisation_label       text,
  personalisation_word_limit  integer check (personalisation_word_limit between 1 and 200),
  -- REQ-H1, REQ-H2: inventory and hamper eligibility
  stock_qty                   integer check (stock_qty is null or stock_qty >= 0),      -- null = not counted
  hamper_eligible             boolean not null default false,
  is_hamper_builder           boolean not null default false,
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  constraint personalisation_needs_limit
    check (not personalisable or personalisation_word_limit is not null),
  constraint hamper_piece_needs_stock_count
    check (not hamper_eligible or stock_qty is not null)
);

-- Same word rule as wordCount() in js/rules.js: runs of non-space characters.
create or replace function pc_word_count(t text) returns integer
language sql immutable as $$
  select case when t is null or btrim(t) = '' then 0
              else coalesce(array_length(regexp_split_to_array(btrim(t), '\s+'), 1), 0) end
$$;

-- ---------- enquiries (orders before Stripe) ----------
create table if not exists enquiries (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,
  customer_name text not null,
  email         text not null,
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
  gift_note             text check (gift_note is null or char_length(gift_note) <= 150)
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
     set stock_qty = stock_qty - need
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
       set stock_qty = p.stock_qty + x.units
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

-- Row level security: visitors read active products; enquiries are written only through
-- a server function (to be added with the Astro build), never directly by the browser.
alter table products enable row level security;
alter table enquiries enable row level security;
alter table enquiry_items enable row level security;
alter table enquiry_hamper_items enable row level security;
drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select using (active);
