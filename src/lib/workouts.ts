import { toDateString } from './fixedExpenses';

export type Exercise = { id: string; name: string; category: string; day_label: string; created_at: string };
export type ExerciseLog = { id: string; exercise_id: string; weight: number; reps: number; logged_at: string };
export type Metric = 'weight' | 'reps' | 'volume';

export const METRIC_LABELS: Record<Metric, string> = { weight: 'Peso', reps: 'Repeticiones', volume: 'Volumen' };
export const NO_DAY = 'Sin día asignado';
export const NO_CATEGORY = 'Sin categoría';
const WEEKDAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 62,5 -> "62,5" · 60 -> "60" */
export const formatNumber = (value: number) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 });
export const formatWeight = (value: number) => `${formatNumber(value)} kg`;
/** Una serie, por ejemplo "60 kg × 10". */
export const formatSet = (log: Pick<ExerciseLog, 'weight' | 'reps'>) => `${formatWeight(log.weight)} × ${log.reps}`;
export const volumeOf = (log: Pick<ExerciseLog, 'weight' | 'reps'>) => Math.round(Number(log.weight) * Number(log.reps) * 100) / 100;

/** "12 oct 2026 · 18:30" en la hora local. */
export function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "hoy", "ayer", "hace 3 días", o la fecha corta si pasó más de un mes. */
export function relativeDay(iso: string, today: string) {
  const day = toDateString(new Date(iso));
  const diff = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 86_400_000);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 31) return `hace ${diff} días`;
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Si el texto es un día de la semana (sin importar tildes ni mayúsculas) devuelve su nombre canónico; si no, el mismo texto. */
export function canonicalDay(label: string) {
  const index = WEEKDAY_ORDER.indexOf(normalize(label));
  return index >= 0 ? WEEKDAYS[index] : label.trim();
}

/** Nombre del día de la semana de una fecha AAAA-MM-DD, por ejemplo "Martes". */
export const weekdayName = (day: string) => WEEKDAYS[(new Date(`${day}T12:00:00`).getDay() + 6) % 7];

/**
 * Agrupa por día/rutina asignado. Los siete días de la semana aparecen siempre (aunque estén vacíos, para poder
 * soltar ahí un ejercicio), en orden; luego tus rutinas por orden alfabético y al final "Sin día asignado" si hay.
 */
export function groupByDay(exercises: Exercise[]) {
  const groups = new Map<string, Exercise[]>();
  WEEKDAYS.forEach(day => groups.set(day, []));
  exercises.forEach(item => { const key = canonicalDay(item.day_label) || NO_DAY; groups.set(key, [...(groups.get(key) ?? []), item]); });
  const rank = (label: string) => { const index = WEEKDAYS.indexOf(label); return index >= 0 ? index : label === NO_DAY ? 1000 : 500; };
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'es'))
    .map(([label, items]) => ({ label, items: items.sort((x, y) => x.name.localeCompare(y.name, 'es')) }));
}

/** Última serie registrada de cada ejercicio (recibe los registros de más nuevo a más antiguo). */
export function lastLogByExercise(logsNewestFirst: ExerciseLog[]) {
  const last = new Map<string, ExerciseLog>();
  logsNewestFirst.forEach(log => { if (!last.has(log.exercise_id)) last.set(log.exercise_id, log); });
  return last;
}

/** Valor de una serie según la métrica elegida para la gráfica. */
export const metricValue = (log: ExerciseLog, metric: Metric) => (metric === 'weight' ? Number(log.weight) : metric === 'reps' ? Number(log.reps) : volumeOf(log));

/**
 * Evolución por día: de las series de un mismo día se toma la mejor (mayor valor de la métrica).
 * Devuelve los puntos de más antiguo a más reciente, listos para la gráfica de líneas.
 */
export function dailySeries(logs: ExerciseLog[], metric: Metric) {
  const best = new Map<string, number>();
  logs.forEach(log => { const day = toDateString(new Date(log.logged_at)); best.set(day, Math.max(best.get(day) ?? 0, metricValue(log, metric))); });
  return [...best.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, total]) => ({ key: day, label: `${Number(day.slice(8))}/${Number(day.slice(5, 7))}`, total: Math.round(total * 100) / 100 }));
}

/** Resumen del historial de un ejercicio. */
export function exerciseStats(logs: ExerciseLog[]) {
  if (logs.length === 0) return { count: 0, bestWeight: 0, bestVolume: 0, sessions: 0, first: null as ExerciseLog | null, last: null as ExerciseLog | null, change: 0 };
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const days = new Set(sorted.map(log => toDateString(new Date(log.logged_at))));
  const bestWeight = Math.max(...sorted.map(log => Number(log.weight)));
  return {
    count: sorted.length,
    bestWeight,
    bestVolume: Math.max(...sorted.map(volumeOf)),
    sessions: days.size,
    first: sorted[0],
    last: sorted[sorted.length - 1],
    // Cambio del mejor peso entre el primer día y el último registrado.
    change: Math.round((bestOfDay(sorted, sorted[sorted.length - 1]) - bestOfDay(sorted, sorted[0])) * 100) / 100,
  };
}

function bestOfDay(sorted: ExerciseLog[], reference: ExerciseLog) {
  const day = toDateString(new Date(reference.logged_at));
  return Math.max(...sorted.filter(log => toDateString(new Date(log.logged_at)) === day).map(log => Number(log.weight)));
}
