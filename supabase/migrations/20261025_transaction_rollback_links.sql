-- Run once in Supabase SQL Editor: link fixed-expense reservations to the income that created them,
-- so deleting that income also removes its reservations (rollback).
alter table public.transactions
  add column if not exists distributes_fixed boolean not null default false;

alter table public.fixed_expense_periods
  add column if not exists source_transaction_id uuid references public.transactions(id) on delete cascade;

create index if not exists fixed_periods_source_idx on public.fixed_expense_periods(source_transaction_id);
