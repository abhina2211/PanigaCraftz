-- PanigaCraftz: hamper sizes (REQ-H6) and hamper-only chocolates and condiments (REQ-H12).
-- Run once in the Supabase SQL editor, after hampers.sql. Safe to run again: it adds a
-- table and two columns, replaces submit_enquiry, and never changes basket prices Neha
-- has set. If you ever re-run schema.sql or hampers.sql, run this file again afterwards,
-- because they replace submit_enquiry with older versions.

-- ---------- sizes ----------
-- The size follows how many pieces are in the hamper, so a customer changes size by
-- adding or removing pieces. Each size has its own basket. Wrapping and the card cost
-- the same for every size: that fee is the build-your-own hamper product's price.
create table if not exists hamper_sizes (
  id            text primary key,
  name          text not null,
  min_pieces    integer not null check (min_pieces >= 1),
  max_pieces    integer not null,
  basket_cents  integer not null check (basket_cents >= 0),
  constraint hamper_size_range check (max_pieces >= min_pieces)
);

-- Starting sizes. Basket prices are placeholders for Neha to confirm. Only added when
-- missing, so running this again keeps the prices she has set.
insert into hamper_sizes (id, name, min_pieces, max_pieces, basket_cents) values
  ('small',  'Small',  3, 4,  800),
  ('medium', 'Medium', 5, 6,  1200),
  ('large',  'Large',  7, 10, 1600)
on conflict (id) do nothing;

-- The builder's price was a $15 placeholder for basket, wrapping and card. It is now
-- the $6 wrapping and card fee only. Changed only while it is still the old placeholder.
update products set price_cents = 600, updated_at = now()
 where is_hamper_builder and price_cents = 1500;

-- What size each custom hamper was, kept on the enquiry. hamper_fee_cents (hampers.sql)
-- now holds the basket plus wrapping and card.
alter table enquiry_items add column if not exists hamper_size text;

-- ---------- submitting an enquiry ----------
-- Same as hampers.sql, plus:
--   REQ-H6: a custom hamper's pieces must fit a size; its fee is that size's basket plus
--           the wrapping fee, and the size is kept on the enquiry.
--   REQ-H12: chocolates and condiments (category 'treats') are only sold inside a hamper.
-- Still one transaction: if any line breaks a rule, nothing is saved.
create or replace function submit_enquiry(payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  e_id uuid; ei_id uuid; new_ref text; line jsonb; item jsonb; pieces integer; prod products;
  sz hamper_sizes; lo integer; hi integer;
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
    if prod.category = 'treats' then raise exception '% is only sold inside a hamper', prod.name; end if;
    insert into enquiry_items (enquiry_id, product_id, qty, personalisation_text, packaging, gift_note,
                               product_name, unit_price_cents, hamper_fee_cents)
    values (e_id, prod.id, (line->>'qty')::int, nullif(line->'opts'->>'text', ''),
            line->'opts'->>'packaging', nullif(line->'opts'->>'note', ''),
            prod.name,
            case when prod.is_hamper_builder then null else prod.price_cents end,
            null)
    returning id into ei_id;

    if prod.is_hamper_builder then
      pieces := 0;
      for item in select * from jsonb_array_elements(coalesce(line->'opts'->'items', '[]'::jsonb)) loop
        insert into enquiry_hamper_items (enquiry_item_id, product_id, qty)
        values (ei_id, item->>'id', (item->>'qty')::int);
        pieces := pieces + (item->>'qty')::int;
      end loop;
      -- REQ-H6: the number of pieces picks the size (Small 3-4, Medium 5-6, Large 7-10).
      select * into sz from hamper_sizes where pieces between min_pieces and max_pieces order by min_pieces limit 1;
      if not found then
        select min(min_pieces), max(max_pieces) into lo, hi from hamper_sizes;
        if pieces < lo or pieces > hi then raise exception 'A hamper needs % to % pieces', lo, hi; end if;
        raise exception 'No hamper size holds % pieces', pieces;
      end if;
      -- REQ-H10: its price is basket + wrapping + its pieces (null if a piece has no price).
      update enquiry_items
         set hamper_size = sz.name,
             hamper_fee_cents = prod.price_cents + sz.basket_cents,
             unit_price_cents = prod.price_cents + sz.basket_cents
                                + (select sum(h.unit_price_cents * h.qty) from enquiry_hamper_items h where h.enquiry_item_id = ei_id)
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
-- Visitors read the sizes (the builder shows them); only admins change basket prices.
alter table hamper_sizes enable row level security;
drop policy if exists "public read hamper sizes" on hamper_sizes;
create policy "public read hamper sizes" on hamper_sizes for select using (true);
drop policy if exists "admins edit hamper sizes" on hamper_sizes;
create policy "admins edit hamper sizes" on hamper_sizes for update to authenticated using (is_admin()) with check (is_admin());
