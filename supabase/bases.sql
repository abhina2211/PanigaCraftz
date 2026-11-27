-- PanigaCraftz: shared blank bases (REQ-B1..B6). Run once in the Supabase SQL editor,
-- after schema.sql and admin.sql. Safe to run again. It does not change any price,
-- stock or setting you already have; it only adds bases and links two designs.
--
-- A base is the blank piece a design is decoupaged onto (for example one 21 cm planter
-- on a timber base). Several designs can share one base. Each design keeps its own
-- count of ready-made pieces (products.stock_qty); the base has its own count of blanks.
-- A design is available while it has ready-made pieces OR its base has blanks (then it
-- is made to order). Ready-made pieces are used first, then blanks.

create table if not exists bases (
  id          text primary key,
  name        text not null,
  stock_qty   integer not null default 0 check (stock_qty >= 0),
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table products add column if not exists base_id text references bases(id);

-- A hamper piece needs something to count: ready-made stock or a base.
alter table products drop constraint if exists hamper_piece_needs_stock_count;
alter table products add constraint hamper_piece_needs_stock_count
  check (not hamper_eligible or stock_qty is not null or base_id is not null);

-- Remember where each hamper piece came from, so a cancel gives back exactly that.
alter table enquiry_hamper_items add column if not exists from_finished integer;
alter table enquiry_hamper_items add column if not exists from_base integer;
alter table enquiry_hamper_items add column if not exists taken_base_id text references bases(id);

-- REQ-B3, REQ-B4: take ready-made pieces first, then blanks from the base. Rows are
-- locked while they change, so two customers can't take the last one.
create or replace function enquiry_hamper_items_take_stock() returns trigger
language plpgsql as $$
declare need integer; fin integer; b text; take_f integer; take_b integer;
begin
  select new.qty * ei.qty into need from enquiry_items ei where ei.id = new.enquiry_item_id;
  select coalesce(stock_qty, 0), base_id into fin, b
    from products where id = new.product_id and hamper_eligible and active for update;
  if not found then raise exception 'Not enough % in stock for this hamper', new.product_id; end if;
  take_f := least(fin, need);
  take_b := need - take_f;
  if take_b > 0 then
    if b is null then raise exception 'Not enough % in stock for this hamper', new.product_id; end if;
    update bases set stock_qty = stock_qty - take_b, updated_at = now()
     where id = b and active and stock_qty >= take_b;
    if not found then raise exception 'Not enough % in stock for this hamper', new.product_id; end if;
  end if;
  if take_f > 0 then
    update products set stock_qty = stock_qty - take_f, updated_at = now() where id = new.product_id;
  end if;
  new.from_finished := take_f;
  new.from_base := take_b;
  new.taken_base_id := case when take_b > 0 then b end;
  return new;
end $$;

-- REQ-B5: cancelling gives back ready-made pieces and blanks to where they came from.
-- (Hamper pieces saved before this file was run were all ready-made.)
create or replace function enquiries_release_stock() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update products p
       set stock_qty = p.stock_qty + x.units, updated_at = now()
      from (select h.product_id, sum(coalesce(h.from_finished, h.qty * ei.qty)) as units
              from enquiry_hamper_items h join enquiry_items ei on ei.id = h.enquiry_item_id
             where ei.enquiry_id = new.id group by h.product_id) x
     where p.id = x.product_id and x.units > 0;
    update bases b
       set stock_qty = b.stock_qty + x.units, updated_at = now()
      from (select h.taken_base_id, sum(h.from_base) as units
              from enquiry_hamper_items h join enquiry_items ei on ei.id = h.enquiry_item_id
             where ei.enquiry_id = new.id and h.taken_base_id is not null group by h.taken_base_id) x
     where b.id = x.taken_base_id;
  end if;
  return new;
end $$;

-- Access: visitors read active bases (the website needs the counts); admins manage them.
alter table bases enable row level security;
drop policy if exists "public read active bases" on bases;
create policy "public read active bases" on bases for select using (active);
drop policy if exists "admins read all bases" on bases;
create policy "admins read all bases" on bases for select to authenticated using (is_admin());
drop policy if exists "admins add bases" on bases;
create policy "admins add bases" on bases for insert to authenticated with check (is_admin());
drop policy if exists "admins edit bases" on bases;
create policy "admins edit bases" on bases for update to authenticated using (is_admin()) with check (is_admin());

create or replace function bases_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_bases_touch on bases;
create trigger trg_bases_touch before update on bases for each row execute function bases_touch();

-- Starting data (REQ-B7): planters, candles, vases and jars share blanks. Counts of 3 are
-- placeholders: Neha sets the real numbers and links other designs in the admin panel.
-- Running this again adds any base that is missing and links designs that have no base
-- yet; it never changes a count or a link Neha has set.
insert into bases (id, name, stock_qty, notes) values
  ('planter-21', '21 cm planter on timber base', 3, 'Bluebell Timber-Base and Aztec Stripe planters'),
  ('candle-jar', 'Frosted candle jar', 3, 'Botanical, personalised name and blue rose candles'),
  ('glass-vase', 'Glass vase', 3, 'Rose crackle vase'),
  ('glass-jar', 'Clip-top glass jar', 3, 'Cookie jar and storage jar')
on conflict (id) do nothing;
update products set base_id = 'planter-21' where id in ('p11', 'p12') and base_id is null;
update products set base_id = 'candle-jar' where id in ('c1', 'c2', 'c3') and base_id is null;
update products set base_id = 'glass-vase' where id in ('v1') and base_id is null;
update products set base_id = 'glass-jar' where id in ('j1', 'j3') and base_id is null;
