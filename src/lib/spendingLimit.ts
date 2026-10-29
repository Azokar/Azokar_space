import { quincenaOf, quincenaShare } from './fixedExpenses';

export type MoneyRow = { amount: number; occurred_on: string };

const cents = (value: number) => Math.round(value * 100) / 100;
const sum = (rows: { amount: number }[]) => cents(rows.reduce((total, row) => total + Number(row.amount), 0));

/**
 * Límite de gasto de la quincena. El límite lo define el usuario (mitad del monto mensual) y los gastos fijos
 * salen de él desde que están **programados**, estén pagados o no. Lo que queda es lo disponible para gastos variables.
 *
 *   disponible para variables = límite de la quincena − gastos fijos programados − gastos variables ya hechos
 *
 * Ejemplo: límite $300, fijos $200 → quedan $100 para variables; cada gasto variable nuevo descuenta de esos $100.
 */
export function limitSummary(
  monthly: number,
  variableExpenses: MoneyRow[],
  fixedExpenses: { monthly_amount: number }[],
  incomes: MoneyRow[],
  today: string,
) {
  const quincena = quincenaOf(today);
  const monthPrefix = today.slice(0, 7);
  const inQuincena = (row: MoneyRow) => row.occurred_on >= quincena.start && row.occurred_on <= quincena.end;

  const quincenaLimit = quincenaShare(monthly, quincena.half);
  const fixedProgrammed = cents(fixedExpenses.reduce((total, item) => total + quincenaShare(Number(item.monthly_amount), quincena.half), 0));
  const variableSpent = sum(variableExpenses.filter(inQuincena));
  const received = sum(incomes.filter(inQuincena));
  const committed = cents(fixedProgrammed + variableSpent);
  const available = cents(quincenaLimit - committed);

  const monthFixed = cents(fixedExpenses.reduce((total, item) => total + Number(item.monthly_amount), 0));
  const monthVariable = sum(variableExpenses.filter(row => row.occurred_on.startsWith(monthPrefix)));
  const monthCommitted = cents(monthFixed + monthVariable);

  return {
    quincena,
    received,
    quincenaLimit,
    fixedProgrammed,
    variableSpent,
    committed,
    /** Disponible para gastos variables en la quincena (negativo si te pasaste). */
    available,
    exceeded: committed > quincenaLimit,
    percent: Math.min(100, Math.round((committed / quincenaLimit) * 100)),
    monthFixed,
    monthVariable,
    monthRemaining: cents(monthly - monthCommitted),
    monthPercent: Math.min(100, Math.round((monthCommitted / monthly) * 100)),
  };
}
