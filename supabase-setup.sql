-- The Daily Tort - Supabase setup
-- Run this in Supabase SQL Editor. Safe to rerun.

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

alter table daily_logs enable row level security;
alter table weight_logs enable row level security;
alter table vet_visits enable row level security;

drop policy if exists "daily logs anon all" on daily_logs;
create policy "daily logs anon all" on daily_logs
for all to anon
using (true)
with check (true);

drop policy if exists "weight logs anon all" on weight_logs;
create policy "weight logs anon all" on weight_logs
for all to anon
using (true)
with check (true);

drop policy if exists "vet visits anon all" on vet_visits;
create policy "vet visits anon all" on vet_visits
for all to anon
using (true)
with check (true);
