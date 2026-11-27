-- PanigaCraftz product photos (REQ-D8). Run once in the Supabase SQL editor, after
-- admin.sql. Safe to run again.
-- Creates a public "product-photos" storage folder: anyone can view the photos (they
-- appear on the website), only admins can upload or replace them.
-- Only photos (JPEG, PNG, WebP) up to 5 MB, so nothing that can run script (SVG, HTML)
-- can be stored here. The admin panel always uploads a shrunk JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload product photos" on storage.objects;
create policy "admins upload product photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_admin());
drop policy if exists "admins replace product photos" on storage.objects;
create policy "admins replace product photos" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());
drop policy if exists "admins remove product photos" on storage.objects;
create policy "admins remove product photos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());
