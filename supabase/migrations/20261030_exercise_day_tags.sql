-- Run once in Supabase SQL Editor: a short tag per training day or routine (e.g. Lunes -> Pecho).
create table if not exists public.exercise_day_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_label text not null check (char_length(day_label) between 1 and 40),
  tag text not null check (char_length(tag) between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_label)
);

alter table public.exercise_day_tags enable row level security;

drop policy if exists "exercise day tag owner access" on public.exercise_day_tags;
create policy "exercise day tag owner access" on public.exercise_day_tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
