create extension if not exists pgcrypto;
create table if not exists public.vehicles (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 category text not null,
 price text not null,
 description text default '',
 specs jsonb default '[]'::jsonb,
 images jsonb default '[]'::jsonb,
 whatsapp text default '5587991732345',
 featured boolean default false,
 created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
create policy "public can read vehicles" on public.vehicles for select using (true);
create policy "authenticated can insert vehicles" on public.vehicles for insert to authenticated with check (true);
create policy "authenticated can update vehicles" on public.vehicles for update to authenticated using (true) with check (true);
create policy "authenticated can delete vehicles" on public.vehicles for delete to authenticated using (true);
