-- Run once in Supabase SQL Editor: gym exercises and their weight/reps history.
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default '' check (char_length(category) <= 40),
  day_label text not null default '' check (char_length(day_label) <= 40),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  weight numeric(7,2) not null check (weight >= 0),
  reps smallint not null check (reps between 1 and 999),
  logged_at timestamptz not null default now(),
  foreign key (exercise_id, user_id) references public.exercises(id, user_id) on delete cascade
);

create index if not exists exercises_user_idx on public.exercises(user_id);
create index if not exists exercise_logs_exercise_idx on public.exercise_logs(exercise_id, logged_at desc);
create index if not exists exercise_logs_user_idx on public.exercise_logs(user_id, logged_at desc);

alter table public.exercises enable row level security;
alter table public.exercise_logs enable row level security;

drop policy if exists "exercise owner access" on public.exercises;
create policy "exercise owner access" on public.exercises for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "exercise log owner access" on public.exercise_logs;
create policy "exercise log owner access" on public.exercise_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
