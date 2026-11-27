-- PanigaCraftz: limits that stop anyone holding all the hamper stock with fake enquiries.
-- Run once in the Supabase SQL editor, after hampers.sql (and photos.sql). Safe to run again.
-- It adds a settings table and triggers. It does not replace submit_enquiry, so it keeps
-- working if hampers.sql or bases.sql are run again later.
--
-- Why: anyone can send an enquiry (that is what the shop is for), and a hamper enquiry holds
-- its pieces' stock until Neha cancels it. Without limits, a script could send enquiries for
-- hundreds of pieces and the shop would show everything sold out. These limits keep one
-- enquiry, one email address and one hour to a sensible size, and give back the stock of
-- enquiries nobody confirmed (REQ-X1..X4 in docs/requirements.md).

-- ---------- the limits, in one row Neha or Abhi can change ----------
-- Change them in Table Editor > enquiry_limits (only through the dashboard: the website and
-- the admin panel can't read or change this table).
create table if not exists enquiry_limits (
  id                   boolean primary key default true check (id),  -- one row only
  max_lines            integer not null default 20 check (max_lines >= 1),
  max_hamper_qty       integer not null default 10 check (max_hamper_qty >= 1),      -- copies of one hamper line
  max_hamper_units     integer not null default 40 check (max_hamper_units >= 1),    -- pieces held by one enquiry
  per_email_per_hour   integer not null default 3 check (per_email_per_hour >= 1),
  per_hour             integer not null default 30 check (per_hour >= 1),            -- whole shop
  hold_days            integer not null default 7 check (hold_days >= 1)             -- unconfirmed enquiries are cancelled after this
);
insert into enquiry_limits (id) values (true) on conflict (id) do nothing;
alter table enquiry_limits enable row level security;  -- no policies: only the dashboard sees it

-- ---------- REQ-X2: how often enquiries can be sent ----------
create index if not exists enquiries_created_at on enquiries (created_at);
create index if not exists enquiries_email on enquiries (lower(email), created_at);
create or replace function enquiries_check_rate() returns trigger
language plpgsql as $$
declare lim enquiry_limits;
begin
  select * into lim from enquiry_limits;
  if (select count(*) from enquiries
       where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= lim.per_email_per_hour then
    raise exception 'Too many enquiries from this email address. Please try again in an hour, or message us on Instagram.';
  end if;
  if (select count(*) from enquiries where created_at > now() - interval '1 hour') >= lim.per_hour then
    raise exception 'We have had a lot of enquiries in the last hour. Please try again soon, or message us on Instagram.';
  end if;
  return new;
end $$;
drop trigger if exists trg_enquiries_check_rate on enquiries;
create trigger trg_enquiries_check_rate before insert on enquiries
  for each row execute function enquiries_check_rate();

-- ---------- REQ-X1: how big one enquiry can be ----------
create or replace function enquiry_items_check_size() returns trigger
language plpgsql as $$
declare lim enquiry_limits;
begin
  select * into lim from enquiry_limits;
  if (select count(*) from enquiry_items where enquiry_id = new.enquiry_id) >= lim.max_lines then
    raise exception 'An enquiry can have at most % items', lim.max_lines;
  end if;
  return new;
end $$;
drop trigger if exists trg_enquiry_items_check_size on enquiry_items;
create trigger trg_enquiry_items_check_size before insert on enquiry_items
  for each row execute function enquiry_items_check_size();

-- A hamper line (custom or ready-made) holds stock, so it has its own caps. Runs before the
-- trigger that takes the stock; if it fails, the whole enquiry is cancelled anyway.
create or replace function enquiry_hamper_items_check_size() returns trigger
language plpgsql as $$
declare lim enquiry_limits; line_qty integer; e_id uuid; held integer;
begin
  select * into lim from enquiry_limits;
  select qty, enquiry_id into line_qty, e_id from enquiry_items where id = new.enquiry_item_id;
  if line_qty > lim.max_hamper_qty then
    raise exception 'A hamper can be ordered at most % at a time. For more, please message us.', lim.max_hamper_qty;
  end if;
  select coalesce(sum(h.qty * ei.qty), 0) into held
    from enquiry_hamper_items h join enquiry_items ei on ei.id = h.enquiry_item_id
   where ei.enquiry_id = e_id;
  if held + new.qty * line_qty > lim.max_hamper_units then
    raise exception 'One enquiry can hold at most % hamper pieces. For more, please message us.', lim.max_hamper_units;
  end if;
  return new;
end $$;
drop trigger if exists trg_enquiry_hamper_items_check_size on enquiry_hamper_items;
create trigger trg_enquiry_hamper_items_check_size before insert on enquiry_hamper_items
  for each row execute function enquiry_hamper_items_check_size();

-- ---------- REQ-X3: unconfirmed enquiries give their stock back ----------
-- Cancels enquiries still "new" after hold_days. Cancelling gives the stock back (REQ-H5).
-- Returns how many it cancelled.
create or replace function expire_stale_enquiries() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update enquiries set status = 'cancelled'
   where status = 'new'
     and created_at < now() - make_interval(days => (select hold_days from enquiry_limits));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function expire_stale_enquiries() from public, anon, authenticated;

-- Run it every hour with pg_cron (Supabase: Database > Extensions > pg_cron, or this file
-- turns it on). Where pg_cron isn't available, this step is skipped with a notice.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('pc-expire-enquiries', '15 * * * *', 'select public.expire_stale_enquiries()');
exception when others then
  raise notice 'pg_cron not available (%): unconfirmed enquiries will not be cancelled automatically', sqlerrm;
end $$;

-- The checks above run inside submit_enquiry, so nothing new is opened to the website.
revoke all on function enquiries_check_rate() from public, anon, authenticated;
revoke all on function enquiry_items_check_size() from public, anon, authenticated;
revoke all on function enquiry_hamper_items_check_size() from public, anon, authenticated;
