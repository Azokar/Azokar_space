/** Agregación de ingresos o gastos por periodo para los reportes de Finanzas. */
import { quincenaOf, toDateString } from './fixedExpenses';

export type ReportRange = 'week' | 'quincena' | 'month' | 'sixMonths' | 'year';
export type ReportRow = { amount: number; date: string; category: string };
export type ReportBucket = { key: string; label: string; total: number };

export const RANGE_LABELS: Record<ReportRange, string> = { week: 'Semana', quincena: 'Quincena', month: 'Mes', sixMonths: '6 meses', year: 'Año' };
export const RANGE_TITLES: Record<ReportRange, string> = { week: 'Últimos 7 días', quincena: 'Quincena actual', month: 'Últimos 30 días', sixMonths: 'Últimos 6 meses', year: 'Últimos 12 meses' };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const cents = (value: number) => Math.round(value * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');

const parse = (day: string) => new Date(`${day}T12:00:00`);
const addDays = (day: string, n: number) => { const date = parse(day); date.setDate(date.getDate() + n); return toDateString(date); };
const monthKey = (day: string) => day.slice(0, 7);

/** Primer día incluido en el rango. Semana/mes son días corridos; 6 meses y año son meses calendario completos. */
export function rangeStart(range: ReportRange, today: string) {
  if (range === 'week') return addDays(today, -6);
  if (range === 'quincena') return quincenaOf(today).start;
  if (range === 'month') return addDays(today, -29);
  const [year, month] = today.split('-').map(Number);
  const back = range === 'sixMonths' ? 5 : 11;
  const first = new Date(year, month - 1 - back, 1);
  return `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`;
}

export function buildReport(rows: ReportRow[], range: ReportRange, today: string) {
  const start = rangeStart(range, today);
  const inRange = rows.filter(row => row.date >= start && row.date <= today);
  const buckets: ReportBucket[] = [];

  if (range === 'week' || range === 'month' || range === 'quincena') {
    // La quincena va desde su inicio (día 1 o 16) hasta hoy: un punto por día.
    const days = range === 'week' ? 7 : range === 'month' ? 30 : Math.round((parse(today).getTime() - parse(start).getTime()) / 86_400_000) + 1;
    for (let i = 0; i < days; i += 1) {
      const day = addDays(start, i);
      buckets.push({ key: day, label: range === 'week' ? WEEKDAYS[parse(day).getDay()] : String(Number(day.slice(8))), total: 0 });
    }
    inRange.forEach(row => { const bucket = buckets.find(item => item.key === row.date); if (bucket) bucket.total += Number(row.amount); });
  } else {
    const months = range === 'sixMonths' ? 6 : 12;
    const [startYear, startMonth] = start.split('-').map(Number);
    for (let i = 0; i < months; i += 1) {
      const date = new Date(startYear, startMonth - 1 + i, 1);
      buckets.push({ key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`, label: MONTHS[date.getMonth()], total: 0 });
    }
    inRange.forEach(row => { const bucket = buckets.find(item => item.key === monthKey(row.date)); if (bucket) bucket.total += Number(row.amount); });
  }

  buckets.forEach(bucket => { bucket.total = cents(bucket.total); });
  const total = cents(buckets.reduce((sum, bucket) => sum + bucket.total, 0));
  const max = buckets.reduce((top, bucket) => Math.max(top, bucket.total), 0);

  const byName = new Map<string, number>();
  inRange.forEach(row => byName.set(row.category, (byName.get(row.category) ?? 0) + Number(row.amount)));
  const categories = [...byName.entries()]
    .map(([name, amount]) => ({ name, amount: cents(amount), percent: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return { start, buckets, total, max, average: cents(total / buckets.length), averageLabel: range === 'week' || range === 'month' || range === 'quincena' ? 'por día' : 'por mes', categories, count: inRange.length };
}

/** Título legible de una barra: "24 oct" para un día, "oct 2026" para un mes. */
export function bucketTitle(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return key.length === 7 ? `${MONTHS[month - 1]} ${year}` : `${day} ${MONTHS[month - 1]}`;
}
