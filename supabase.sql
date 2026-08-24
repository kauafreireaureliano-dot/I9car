create extension if not exists pgcrypto;

create table if not exists public.vehicles (
 id uuid primary key default gen_random_uuid(), title text not null, category text not null, price text not null,
 description text default '', specs jsonb default '[]'::jsonb, images jsonb default '[]'::jsonb,
 whatsapp text default '5587991732345', featured boolean default false, created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
create policy "public can read vehicles" on public.vehicles for select using (true);
create policy "authenticated can insert vehicles" on public.vehicles for insert to authenticated with check (true);
create policy "authenticated can update vehicles" on public.vehicles for update to authenticated using (true) with check (true);
create policy "authenticated can delete vehicles" on public.vehicles for delete to authenticated using (true);

-- CRM i9
create table if not exists public.crm_leads (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 phone text default '',
 vehicle text default '',
 vehicle_value text default '',
 source text default 'Meta Ads',
 campaign text default '',
 creative text default '',
 quality text default 'morno',
 status text default 'novo',
 notes text default '',
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);
alter table public.crm_leads enable row level security;
create policy "authenticated can read crm leads" on public.crm_leads for select to authenticated using (true);
create policy "authenticated can insert crm leads" on public.crm_leads for insert to authenticated with check (true);
create policy "authenticated can update crm leads" on public.crm_leads for update to authenticated using (true) with check (true);
create policy "authenticated can delete crm leads" on public.crm_leads for delete to authenticated using (true);

create table if not exists public.traffic_results (
 id uuid primary key default gen_random_uuid(),
 period text not null,
 spend numeric default 0,
 conversations integer default 0,
 qualified integer default 0,
 evaluations integer default 0,
 cars_bought integer default 0,
 cars_sold integer default 0,
 created_at timestamptz default now()
);
alter table public.traffic_results enable row level security;
create policy "authenticated can read traffic results" on public.traffic_results for select to authenticated using (true);
create policy "authenticated can insert traffic results" on public.traffic_results for insert to authenticated with check (true);
create policy "authenticated can update traffic results" on public.traffic_results for update to authenticated using (true) with check (true);
create policy "authenticated can delete traffic results" on public.traffic_results for delete to authenticated using (true);
