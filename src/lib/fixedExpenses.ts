/** Lógica de gastos fijos mensuales repartidos por quincena (1–15 y 16–fin de mes). */

export type FixedExpense = { id: string; name: string; monthly_amount: number; due_day: number; created_at: string };
export type FixedPeriod = { id: string; fixed_expense_id: string; period_start: string; amount: number; paid_at: string | null };
export type Quincena = { start: string; end: string; half: 1 | 2; label: string };

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const cents = (value: number) => Math.round(value * 100) / 100;

export const toDateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Quincena a la que pertenece una fecha AAAA-MM-DD. */
export function quincenaOf(day: string): Quincena {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const half: 1 | 2 = dayOfMonth <= 15 ? 1 : 2;
  const lastDay = daysInMonth(year, month);
  const start = `${year}-${pad(month)}-${half === 1 ? '01' : '16'}`;
  const end = `${year}-${pad(month)}-${half === 1 ? '15' : pad(lastDay)}`;
  return { start, end, half, label: `${half === 1 ? 1 : 16}–${half === 1 ? 15 : lastDay} ${MONTHS[month - 1]}` };
}

/** Parte de un gasto mensual que corresponde a una quincena. La 2.ª absorbe el centavo sobrante. */
export function quincenaShare(monthlyAmount: number, half: 1 | 2) {
  const first = Math.floor((monthlyAmount * 100) / 2) / 100;
  return half === 1 ? first : cents(monthlyAmount - first);
}

const nextDay = (day: string) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + 1); return toDateString(date); };

/** Fecha corta legible: 2026-11-01 -> "1 nov". */
export function shortDate(day: string) {
  const [, month, dayOfMonth] = day.split('-').map(Number);
  return `${dayOfMonth} ${MONTHS[month - 1]}`;
}

/** Día límite efectivo en el mes de `day` (un 31 en febrero pasa a ser el último día). */
export function dueDateFor(day: string, dueDay: number) {
  const [year, month] = day.split('-').map(Number);
  return `${year}-${pad(month)}-${pad(Math.min(dueDay, daysInMonth(year, month)))}`;
}

/**
 * Fecha límite del ciclo de una quincena: la primera ocurrencia del día de pago que sea
 * igual o posterior al inicio de la quincena y estrictamente posterior al día de creación.
 * Así, un gasto creado el 24 con pago el día 1 queda programado para el 1 del mes siguiente.
 */
export function deadlineFor(expense: FixedExpense, quincena: Quincena) {
  const createdOn = toDateString(new Date(expense.created_at));
  const from = [quincena.start, nextDay(createdOn)].sort()[1];
  let [year, month] = from.split('-').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const candidate = dueDateFor(`${year}-${pad(month)}-01`, expense.due_day);
    if (candidate >= from) return candidate;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return dueDateFor(from, expense.due_day);
}

export type ExpenseStatus = {
  share: number;
  reserved: number;
  paid: boolean;
  pending: number;
  overdue: boolean;
  coveredPercent: number;
  dueDate: string;
};

/** Estado de un gasto fijo en la quincena de `today`. Vence en rojo si llegó su fecha y no está pagado. */
export function expenseStatus(expense: FixedExpense, periods: FixedPeriod[], today: string): ExpenseStatus {
  const quincena = quincenaOf(today);
  const monthPrefix = today.slice(0, 7);
  const share = quincenaShare(Number(expense.monthly_amount), quincena.half);
  const own = periods.filter(period => period.fixed_expense_id === expense.id);
  const current = own.find(period => period.period_start === quincena.start);
  const paid = !!current?.paid_at;
  const reserved = cents(own.filter(period => period.period_start.startsWith(monthPrefix)).reduce((sum, period) => sum + Number(period.amount), 0));
  const dueDate = deadlineFor(expense, quincena);
  return {
    share,
    reserved,
    paid,
    pending: paid ? 0 : share,
    overdue: !paid && today >= dueDate,
    coveredPercent: Math.min(100, Math.round((reserved / Number(expense.monthly_amount)) * 100)),
    dueDate,
  };
}

/** Resumen de la quincena: lo ingresado, lo reservado para gastos fijos y lo que queda disponible. */
export function quincenaSummary(
  expenses: FixedExpense[],
  periods: FixedPeriod[],
  transactions: { kind: 'income' | 'expense'; amount: number; occurred_on: string }[],
  today: string,
) {
  const quincena = quincenaOf(today);
  const inRange = transactions.filter(row => row.occurred_on >= quincena.start && row.occurred_on <= quincena.end);
  const income = cents(inRange.filter(row => row.kind === 'income').reduce((sum, row) => sum + Number(row.amount), 0));
  const spent = cents(inRange.filter(row => row.kind === 'expense').reduce((sum, row) => sum + Number(row.amount), 0));
  const reserved = cents(periods.filter(period => period.period_start === quincena.start && expenses.some(item => item.id === period.fixed_expense_id)).reduce((sum, period) => sum + Number(period.amount), 0));
  const fixedShare = cents(expenses.reduce((sum, item) => sum + quincenaShare(Number(item.monthly_amount), quincena.half), 0));
  return { quincena, income, spent, reserved, fixedShare, available: cents(income - reserved - spent) };
}

/** Vista rápida de todos los gastos fijos del mes: % cubierto, dinero reservado frente al faltante y vencidos. */
export function fixedOverview(expenses: FixedExpense[], periods: FixedPeriod[], today: string) {
  const monthPrefix = today.slice(0, 7);
  const ids = new Set(expenses.map(item => item.id));
  const monthPeriods = periods.filter(period => ids.has(period.fixed_expense_id) && period.period_start.startsWith(monthPrefix));
  const total = cents(expenses.reduce((sum, item) => sum + Number(item.monthly_amount), 0));
  const reserved = cents(monthPeriods.reduce((sum, period) => sum + Number(period.amount), 0));
  return {
    total,
    reserved,
    missing: cents(Math.max(0, total - reserved)),
    reservedPercent: total > 0 ? Math.min(100, Math.round((reserved / total) * 100)) : 0,
    overdueCount: expenses.filter(item => expenseStatus(item, periods, today).overdue).length,
  };
}
