-- Run once in Supabase SQL Editor: monthly spending limit per user (split by quincena in the app).
create table if not exists public.spending_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  updated_at timestamptz not null default now()
);

alter table public.spending_limits enable row level security;

drop policy if exists "spending limit owner access" on public.spending_limits;
create policy "spending limit owner access" on public.spending_limits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
