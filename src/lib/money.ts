import { supabase } from './supabase';
import { limitSummary, type MoneyRow } from './spendingLimit';

export type MoneyOverview = {
  /** Total general: todo lo que has recibido menos todo lo que has gastado (incluidos los gastos fijos pagados). */
  account: number;
  /** Apartado para gastos = fijos reservados sin pagar + lo que queda del presupuesto de la quincena. */
  setAsideExpenses: number;
  fixedReserved: number;
  operativeBudget: number;
  limitDefined: boolean;
  /** Dinero asignado a metas: lo aportado a cada una. */
  setAsideGoals: number;
  /** Lo que no está asignado a gastos ni a metas. Puede ser negativo si asignaste más de lo que tienes. */
  free: number;
  monthIncome: number;
  monthExpenses: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;
type Totals = { income_total: number; expense_total: number; fixed_paid_total: number; fixed_reserved_unpaid: number; goals_total: number };

/**
 * Calcula el desglose "Tu dinero". Los totales históricos los suma la base de datos (función `finance_totals`);
 * el presupuesto de la quincena se calcula aquí con las mismas reglas que la tarjeta del límite de gastos.
 */
export async function fetchMoneyOverview(userId: string, today: string): Promise<MoneyOverview> {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [totals, limitRow, fixedRows, monthRows, paidRows] = await Promise.all([
    supabase.rpc('finance_totals'),
    supabase.from('spending_limits').select('monthly_amount').eq('user_id', userId).maybeSingle(),
    supabase.from('fixed_expenses').select('monthly_amount').eq('user_id', userId),
    supabase.from('transactions').select('kind, amount, occurred_on').eq('user_id', userId).gte('occurred_on', monthStart).lte('occurred_on', today).limit(5000),
    supabase.from('fixed_expense_periods').select('amount, paid_at').eq('user_id', userId).not('paid_at', 'is', null).gte('paid_at', `${monthStart}T00:00:00`),
  ]);
  if (totals.error) throw new Error(totals.error.message);
  const failure = limitRow.error ?? fixedRows.error ?? monthRows.error;
  if (failure) throw new Error(failure.message);

  const row = (Array.isArray(totals.data) ? totals.data[0] : totals.data) as Totals | undefined;
  const incomeTotal = Number(row?.income_total ?? 0);
  const expenseTotal = Number(row?.expense_total ?? 0);
  const fixedPaid = Number(row?.fixed_paid_total ?? 0);
  const fixedReserved = Number(row?.fixed_reserved_unpaid ?? 0);
  const goals = Number(row?.goals_total ?? 0);

  const month = (monthRows.data ?? []) as { kind: 'income' | 'expense'; amount: number; occurred_on: string }[];
  const incomes: MoneyRow[] = month.filter(item => item.kind === 'income');
  const variable: MoneyRow[] = month.filter(item => item.kind === 'expense');
  const monthlyLimit = limitRow.data ? Number(limitRow.data.monthly_amount) : null;

  // Presupuesto de la quincena que aún queda para gastos variables (sin límite definido no se aparta nada).
  const operativeBudget = monthlyLimit !== null
    ? Math.max(0, limitSummary(monthlyLimit, variable, (fixedRows.data ?? []) as { monthly_amount: number }[], incomes, today).available)
    : 0;

  const account = cents(incomeTotal - expenseTotal - fixedPaid);
  const setAsideExpenses = cents(fixedReserved + operativeBudget);
  const monthPaidFixed = cents(((paidRows.data ?? []) as { amount: number }[]).reduce((total, item) => total + Number(item.amount), 0));

  return {
    account,
    setAsideExpenses,
    fixedReserved: cents(fixedReserved),
    operativeBudget: cents(operativeBudget),
    limitDefined: monthlyLimit !== null,
    setAsideGoals: cents(goals),
    free: cents(account - setAsideExpenses - goals),
    monthIncome: cents(incomes.reduce((total, item) => total + Number(item.amount), 0)),
    monthExpenses: cents(variable.reduce((total, item) => total + Number(item.amount), 0) + monthPaidFixed),
  };
}
