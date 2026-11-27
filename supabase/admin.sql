-- PanigaCraftz admin access (REQ-D5). Run once in the Supabase SQL editor, after
-- schema.sql. Safe to run again.
--
-- Who is an admin: only people listed in the admins table. Signing up is not
-- enough. To make Neha an admin, after creating her login in
-- Authentication > Users > Add user, run (with her email):
--   insert into admins (user_id) select id from auth.users where email = 'her@email' on conflict do nothing;

create table if not exists admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table admins enable row level security;

-- True when the signed-in person is in the admins table. security definer so it
-- can read admins without opening that table to anyone.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function is_admin() to anon, authenticated;

-- An admin can see their own admin row (lets the admin page check access).
drop policy if exists "admins see themselves" on admins;
create policy "admins see themselves" on admins for select to authenticated using (user_id = auth.uid());

-- Products: admins see inactive products too, and can add and edit them.
-- There is no delete: set active = false to hide a product (old enquiries keep it).
drop policy if exists "admins read all products" on products;
create policy "admins read all products" on products for select to authenticated using (is_admin());
drop policy if exists "admins add products" on products;
create policy "admins add products" on products for insert to authenticated with check (is_admin());
drop policy if exists "admins edit products" on products;
create policy "admins edit products" on products for update to authenticated using (is_admin()) with check (is_admin());

-- Enquiries: admins read everything and change the status (cancelling returns stock).
drop policy if exists "admins read enquiries" on enquiries;
create policy "admins read enquiries" on enquiries for select to authenticated using (is_admin());
drop policy if exists "admins update enquiry status" on enquiries;
create policy "admins update enquiry status" on enquiries for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admins read enquiry items" on enquiry_items;
create policy "admins read enquiry items" on enquiry_items for select to authenticated using (is_admin());
drop policy if exists "admins read hamper items" on enquiry_hamper_items;
create policy "admins read hamper items" on enquiry_hamper_items for select to authenticated using (is_admin());

-- Only the status of an enquiry can change from the admin page; customer details stay as sent.
revoke update on enquiries from authenticated;
grant update (status) on enquiries to authenticated;

-- Keep updated_at current on every product edit.
create or replace function products_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_products_touch on products;
create trigger trg_products_touch before update on products for each row execute function products_touch();
