-- Run once in Supabase SQL Editor: one row per closed day with how many habits were completed.
-- The "Camino a la Luna" points (+2 successful day, -1 otherwise, 0..100) are computed from this history.
create table if not exists public.habit_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  total smallint not null check (total > 0),
  done smallint not null check (done >= 0),
  successful boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.habit_days enable row level security;

drop policy if exists "habit day owner access" on public.habit_days;
create policy "habit day owner access" on public.habit_days for all using (user_id = auth.uid()) with check (user_id = auth.uid());
