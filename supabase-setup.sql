-- The Daily Tort - Supabase setup
-- Run this in Supabase SQL Editor.

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  care_date date not null unique,
  soak_status text default 'not logged',
  humidifier_refilled boolean default false,
  calcium_given boolean default false,
  greens_fed boolean default false,
  greens_text text,
  fruit_fed boolean default false,
  fruit_text text,
  veggie_fed boolean default false,
  veggie_text text,
  protein_fed boolean default false,
  protein_text text,
  outside_time boolean default false,
  outside_duration text,
  care_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  weigh_date date not null,
  weight_value text not null,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists vet_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

-- No-login starter mode:
-- These policies allow the public anon key to read/write these tables.
-- Anyone who has your site URL and anon key could access the data.
-- This is okay for a simple private starter app, but add login later for stronger privacy.

alter table daily_logs enable row level security;
alter table weight_logs enable row level security;
alter table vet_visits enable row level security;

drop policy if exists "daily logs anon read" on daily_logs;
drop policy if exists "daily logs anon insert" on daily_logs;
drop policy if exists "daily logs anon update" on daily_logs;
drop policy if exists "daily logs anon delete" on daily_logs;

create policy "daily logs anon read" on daily_logs for select to anon using (true);
create policy "daily logs anon insert" on daily_logs for insert to anon with check (true);
create policy "daily logs anon update" on daily_logs for update to anon using (true) with check (true);
create policy "daily logs anon delete" on daily_logs for delete to anon using (true);

drop policy if exists "weight logs anon read" on weight_logs;
drop policy if exists "weight logs anon insert" on weight_logs;
drop policy if exists "weight logs anon update" on weight_logs;
drop policy if exists "weight logs anon delete" on weight_logs;

create policy "weight logs anon read" on weight_logs for select to anon using (true);
create policy "weight logs anon insert" on weight_logs for insert to anon with check (true);
create policy "weight logs anon update" on weight_logs for update to anon using (true) with check (true);
create policy "weight logs anon delete" on weight_logs for delete to anon using (true);

drop policy if exists "vet visits anon read" on vet_visits;
drop policy if exists "vet visits anon insert" on vet_visits;
drop policy if exists "vet visits anon update" on vet_visits;
drop policy if exists "vet visits anon delete" on vet_visits;

create policy "vet visits anon read" on vet_visits for select to anon using (true);
create policy "vet visits anon insert" on vet_visits for insert to anon with check (true);
create policy "vet visits anon update" on vet_visits for update to anon using (true) with check (true);
create policy "vet visits anon delete" on vet_visits for delete to anon using (true);
