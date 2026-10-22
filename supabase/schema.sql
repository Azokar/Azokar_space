-- Pulso: esquema inicial para Supabase (PostgreSQL)
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
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
