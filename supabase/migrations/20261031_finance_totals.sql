-- Run once in Supabase SQL Editor: totals used by the "Tu dinero" breakdown (account, set aside for expenses/goals, free).
-- security invoker + explicit auth.uid() filter: each user only ever sums their own rows.
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
