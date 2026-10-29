-- Pulso: esquema inicial para Supabase (PostgreSQL)
create extension if not exists pgcrypto;

-- Profile images are public URLs; writes are limited to each user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create type public.transaction_kind as enum ('income', 'expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind public.transaction_kind not null,
  icon text not null default 'circle',
  color text not null default '#16A34A',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind),
  unique (id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid,
  kind public.transaction_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  occurred_on date not null default current_date,
  distributes_fixed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories(id, user_id) on delete set null (category_id)
);

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  scheduled_days smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (scheduled_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  unique (id, user_id)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  completed_on date not null default current_date,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits(id, user_id) on delete cascade,
  unique (habit_id, completed_on)
);

create table public.weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  details text not null default '',
  scheduled_on date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions(user_id, occurred_on desc);
create index goals_user_idx on public.financial_goals(user_id);
create index habits_user_active_idx on public.habits(user_id, is_active);
create index habit_logs_user_date_idx on public.habit_logs(user_id, completed_on);
create index tasks_user_date_idx on public.weekly_tasks(user_id, scheduled_on);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.financial_goals enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.weekly_tasks enable row level security;

create policy "profile owner access" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "category owner access" on public.categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transaction owner access" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goal owner access" on public.financial_goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit owner access" on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit log owner access" on public.habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "task owner access" on public.weekly_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fixed expenses by quincena (also in migrations/20261024_fixed_expenses.sql)

create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  due_day smallint not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- One row per fixed expense and quincena: the amount reserved from an income and whether it was paid.
create table public.fixed_expense_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixed_expense_id uuid not null,
  period_start date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz,
  source_transaction_id uuid references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fixed_expense_id, period_start),
  foreign key (fixed_expense_id, user_id) references public.fixed_expenses(id, user_id) on delete cascade
);

create index fixed_expenses_user_idx on public.fixed_expenses(user_id);
create index fixed_periods_user_start_idx on public.fixed_expense_periods(user_id, period_start);

alter table public.fixed_expenses enable row level security;
alter table public.fixed_expense_periods enable row level security;

create policy "fixed expense owner access" on public.fixed_expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fixed period owner access" on public.fixed_expense_periods for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Monthly spending limit (also in migrations/20261027_spending_limits.sql)
create table public.spending_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  updated_at timestamptz not null default now()
);
alter table public.spending_limits enable row level security;
create policy "spending limit owner access" on public.spending_limits for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Closed habit days for the "Camino a la Luna" points (also in migrations/20261028_habit_days.sql)
create table public.habit_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  total smallint not null check (total > 0),
  done smallint not null check (done >= 0),
  successful boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.habit_days enable row level security;
create policy "habit day owner access" on public.habit_days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Gym exercises and weight/reps history (also in migrations/20261029_exercises.sql)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default '' check (char_length(category) <= 40),
  day_label text not null default '' check (char_length(day_label) <= 40),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  weight numeric(7,2) not null check (weight >= 0),
  reps smallint not null check (reps between 1 and 999),
  logged_at timestamptz not null default now(),
  foreign key (exercise_id, user_id) references public.exercises(id, user_id) on delete cascade
);

create index exercises_user_idx on public.exercises(user_id);
create index exercise_logs_exercise_idx on public.exercise_logs(exercise_id, logged_at desc);
create index exercise_logs_user_idx on public.exercise_logs(user_id, logged_at desc);

alter table public.exercises enable row level security;
alter table public.exercise_logs enable row level security;

create policy "exercise owner access" on public.exercises for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "exercise log owner access" on public.exercise_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tag per training day or routine (also in migrations/20261030_exercise_day_tags.sql)
create table public.exercise_day_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_label text not null check (char_length(day_label) between 1 and 40),
  tag text not null check (char_length(tag) between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_label)
);
alter table public.exercise_day_tags enable row level security;
create policy "exercise day tag owner access" on public.exercise_day_tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Totals for the "Tu dinero" breakdown (also in migrations/20261031_finance_totals.sql)
create or replace function public.finance_totals()
returns table (income_total numeric, expense_total numeric, fixed_paid_total numeric, fixed_reserved_unpaid numeric, goals_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce((select sum(amount) from public.transactions where user_id = auth.uid() and kind = 'income'), 0),
    coalesce((select sum(amount) from public.transactions where user_id = auth.uid() and kind = 'expense'), 0),
    coalesce((select sum(amount) from public.fixed_expense_periods where user_id = auth.uid() and paid_at is not null), 0),
    coalesce((select sum(amount) from public.fixed_expense_periods where user_id = auth.uid() and paid_at is null), 0),
    coalesce((select sum(current_amount) from public.financial_goals where user_id = auth.uid()), 0);
$$;

revoke all on function public.finance_totals() from public, anon;
grant execute on function public.finance_totals() to authenticated;

-- Endurecimiento de seguridad (20261101_security_hardening)
-- 1) Las funciones de disparador no deben poder llamarse desde la API (/rest/v1/rpc/...).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Las fotos de perfil siguen viéndose por su URL pública (el bucket es público), pero ya no se puede
--    listar el bucket completo: antes cualquiera podía enumerar los archivos y, con ellos, los ids de usuario.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Users read their own avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
