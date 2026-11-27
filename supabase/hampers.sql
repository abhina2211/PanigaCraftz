-- PanigaCraftz: ready-made hamper contents (REQ-H8) and prices kept on enquiries (REQ-H10).
-- Run once in the Supabase SQL editor, after schema.sql, admin.sql and bases.sql.
-- Safe to run again. It adds a table and columns, replaces two functions, and gives
-- the Christmas and Diwali hampers their starting contents if they have none yet.
-- It does not change any price, stock count or base. If you ever re-run schema.sql
-- or bases.sql, run this file again afterwards, because they replace the same functions.

-- ---------- what is inside each ready-made hamper ----------
-- A ready-made hamper is made from the same pieces customers can buy on their own.
-- Sending an enquiry for it takes those pieces' stock, the same way a custom hamper
-- does, and cancelling gives it back. Pieces whose stock isn't counted (no stock
-- count and no base) don't limit the hamper.
create table if not exists hamper_pieces (
  hamper_id  text not null references products(id) on delete cascade,
  piece_id   text not null references products(id),
  qty        integer not null default 1 check (qty between 1 and 20),
  primary key (hamper_id, piece_id),
  constraint hamper_not_its_own_piece check (hamper_id <> piece_id)
);

-- ---------- prices kept on enquiries (REQ-H10) ----------
-- Copied when the enquiry is sent, so later price changes don't change it.
alter table enquiry_items add column if not exists product_name text;
alter table enquiry_items add column if not exists unit_price_cents integer;  -- custom hamper: fee + its pieces; null = price on enquiry
alter table enquiry_items add column if not exists hamper_fee_cents integer;  -- custom hamper only: basket, wrapping and card
alter table enquiry_hamper_items add column if not exists product_name text;
alter table enquiry_hamper_items add column if not exists unit_price_cents integer;

-- ---------- taking stock for hamper pieces ----------
-- Same as bases.sql (ready-made pieces first, then blanks, rows locked), plus:
-- a custom hamper only takes pieces marked for hampers; a ready-made hamper takes
-- whatever it lists, skipping pieces whose stock isn't counted. Each piece's name and
-- price are copied onto the enquiry.
create or replace function enquiry_hamper_items_take_stock() returns trigger
language plpgsql as $$
declare
  need integer; fin integer; b text; take_f integer; take_b integer;
  builder boolean; eligible boolean; counted boolean; pname text; pprice integer;
begin
  select new.qty * ei.qty, h.is_hamper_builder into need, builder
    from enquiry_items ei join products h on h.id = ei.product_id
   where ei.id = new.enquiry_item_id;
  select coalesce(stock_qty, 0), base_id, hamper_eligible, (stock_qty is not null or base_id is not null), name, price_cents
    into fin, b, eligible, counted, pname, pprice
    from products where id = new.product_id and active for update;
  if not found or (builder and not eligible) then
    raise exception 'Not enough % in stock for this hamper', new.product_id;
  end if;
  new.product_name := pname;
  new.unit_price_cents := pprice;
  if not counted then
    new.from_finished := 0; new.from_base := 0; new.taken_base_id := null;
    return new;
  end if;
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

-- ---------- submitting an enquiry ----------
-- Same as schema.sql, plus: every line keeps its name and price; a custom hamper keeps
-- its fee and is priced as fee + pieces; a ready-made hamper takes its listed pieces.
-- Still one transaction: if any line breaks a rule, nothing is saved.
create or replace function submit_enquiry(payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  e_id uuid; ei_id uuid; new_ref text; line jsonb; item jsonb; pieces integer; prod products;
begin
  if jsonb_array_length(coalesce(payload->'lines', '[]'::jsonb)) = 0 then
    raise exception 'The enquiry has no items';
  end if;
  new_ref := 'PC-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into enquiries (ref, customer_name, email, phone, postcode)
  values (new_ref, payload->>'name', payload->>'email', nullif(payload->>'phone', ''), nullif(payload->>'postcode', ''))
  returning id into e_id;

  for line in select * from jsonb_array_elements(payload->'lines') loop
    select * into prod from products where id = line->>'id' and active;
    if not found then raise exception 'Unknown product %', line->>'id'; end if;
    insert into enquiry_items (enquiry_id, product_id, qty, personalisation_text, packaging, gift_note,
                               product_name, unit_price_cents, hamper_fee_cents)
    values (e_id, prod.id, (line->>'qty')::int, nullif(line->'opts'->>'text', ''),
            line->'opts'->>'packaging', nullif(line->'opts'->>'note', ''),
            prod.name,
            case when prod.is_hamper_builder then null else prod.price_cents end,
            case when prod.is_hamper_builder then prod.price_cents end)
    returning id into ei_id;

    if prod.is_hamper_builder then
      pieces := 0;
      for item in select * from jsonb_array_elements(coalesce(line->'opts'->'items', '[]'::jsonb)) loop
        insert into enquiry_hamper_items (enquiry_item_id, product_id, qty)
        values (ei_id, item->>'id', (item->>'qty')::int);
        pieces := pieces + (item->>'qty')::int;
      end loop;
      -- REQ-H6: a build-your-own hamper has 2 to 8 pieces.
      if pieces < 2 or pieces > 8 then raise exception 'A hamper needs 2 to 8 pieces'; end if;
      -- REQ-H10: its price is the fee plus its pieces (null if a piece has no price).
      update enquiry_items
         set unit_price_cents = prod.price_cents + (select sum(h.unit_price_cents * h.qty) from enquiry_hamper_items h where h.enquiry_item_id = ei_id)
       where id = ei_id;
    else
      if jsonb_array_length(coalesce(line->'opts'->'items', '[]'::jsonb)) > 0 then
        raise exception 'Only the build-your-own hamper can hold pieces';
      end if;
      -- REQ-H8: a ready-made hamper takes the pieces it lists.
      insert into enquiry_hamper_items (enquiry_item_id, product_id, qty)
      select ei_id, hp.piece_id, hp.qty from hamper_pieces hp where hp.hamper_id = prod.id;
    end if;
  end loop;
  return new_ref;
end $$;
revoke all on function submit_enquiry(jsonb) from public;
grant execute on function submit_enquiry(jsonb) to anon, authenticated;

-- ---------- access ----------
-- Visitors read hamper contents (the website shows a hamper as sold out when a piece
-- runs out); only admins change them.
alter table hamper_pieces enable row level security;
drop policy if exists "public read hamper pieces" on hamper_pieces;
create policy "public read hamper pieces" on hamper_pieces for select using (true);
drop policy if exists "admins add hamper pieces" on hamper_pieces;
create policy "admins add hamper pieces" on hamper_pieces for insert to authenticated with check (is_admin());
drop policy if exists "admins edit hamper pieces" on hamper_pieces;
create policy "admins edit hamper pieces" on hamper_pieces for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admins remove hamper pieces" on hamper_pieces;
create policy "admins remove hamper pieces" on hamper_pieces for delete to authenticated using (is_admin());

-- ---------- starting contents (placeholders, Neha to confirm) ----------
-- Christmas & Kris Kringle hamper (h5): chocolate box, botanical candle, mini planter.
-- Diwali hamper (h4): festive tea light set, chocolate box.
-- Only added to a hamper that has no contents yet, so running this again never
-- changes contents Neha has set. To change them, edit the hamper_pieces table.
insert into hamper_pieces (hamper_id, piece_id, qty)
select v.h, v.p, v.q
  from (values ('h5', 'j2', 1), ('h5', 'c1', 1), ('h5', 'p8', 1), ('h4', 't3', 1), ('h4', 'j2', 1)) as v(h, p, q)
 where exists (select 1 from products where id = v.h)
   and exists (select 1 from products where id = v.p)
   and not exists (select 1 from hamper_pieces x where x.hamper_id = v.h)
on conflict do nothing;
