-- Run once in Supabase SQL Editor: fixed monthly expenses split by quincena (1-15 and 16-end).

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  due_day smallint not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- One row per fixed expense and quincena: the amount reserved from an income and whether it was paid.
create table if not exists public.fixed_expense_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixed_expense_id uuid not null,
  period_start date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (fixed_expense_id, period_start),
  foreign key (fixed_expense_id, user_id) references public.fixed_expenses(id, user_id) on delete cascade
);

create index if not exists fixed_expenses_user_idx on public.fixed_expenses(user_id);
create index if not exists fixed_periods_user_start_idx on public.fixed_expense_periods(user_id, period_start);

alter table public.fixed_expenses enable row level security;
alter table public.fixed_expense_periods enable row level security;

drop policy if exists "fixed expense owner access" on public.fixed_expenses;
create policy "fixed expense owner access" on public.fixed_expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "fixed period owner access" on public.fixed_expense_periods;
create policy "fixed period owner access" on public.fixed_expense_periods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
