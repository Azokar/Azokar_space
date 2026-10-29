import { supabase } from './supabase';
import { toDateString } from './fixedExpenses';

/** Puntos para llegar a la Luna. */
export const MOON_GOAL = 100;
export const POINTS_SUCCESS = 2;
export const POINTS_FAIL = 1;

export type HabitDay = { day: string; total: number; done: number; successful: boolean };

const addDays = (day: string, n: number) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + n); return toDateString(date); };

/** Lee todas las filas de una consulta paginando de 1000 en 1000 (tope del servidor). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

/**
 * Suma +2 por día exitoso y resta 1 por día no exitoso, siempre entre 0 y 100.
 * Devuelve también la evolución día a día.
 */
export function foldPoints(days: HabitDay[]) {
  let points = 0;
  const series = days.map(item => {
    points = item.successful ? Math.min(MOON_GOAL, points + POINTS_SUCCESS) : Math.max(0, points - POINTS_FAIL);
    return { day: item.day, points };
  });
  return { points, series };
}

/** Estadísticas del historial de días cerrados. */
export function habitStats(days: HabitDay[]) {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const { points, series } = foldPoints(sorted);
  const successful = sorted.filter(item => item.successful).length;

  let best = 0;
  let run = 0;
  let previous = '';
  sorted.forEach(item => {
    run = item.successful ? (previous && addDays(previous, 1) === item.day && run > 0 ? run + 1 : 1) : 0;
    if (item.successful) best = Math.max(best, run);
    previous = item.day;
  });
  // Racha actual: días exitosos consecutivos hasta el último día cerrado.
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (!sorted[i].successful) break;
    if (current > 0 && addDays(sorted[i].day, 1) !== sorted[i + 1].day) break;
    current += 1;
  }

  return {
    points,
    series,
    tracked: sorted.length,
    successful,
    failed: sorted.length - successful,
    rate: sorted.length ? Math.round((successful / sorted.length) * 100) : 0,
    currentStreak: current,
    bestStreak: best,
    reachedMoon: points >= MOON_GOAL,
  };
}

/**
 * Cierra los días ya terminados: guarda cuántos hábitos se completaron en cada uno.
 * Se ejecuta al abrir la pantalla, así que los días en que no abriste la app cuentan como no exitosos.
 * Solo cuentan los hábitos que ya existían ese día, y los días sin hábitos no suman ni restan.
 */
export async function closePastDays(userId: string, today: string) {
  const [habitsRes, lastRes] = await Promise.all([
    supabase.from('habits').select('id, created_at').eq('user_id', userId).eq('is_active', true),
    supabase.from('habit_days').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(1),
  ]);
  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (lastRes.error) throw new Error(lastRes.error.message);

  const habits = (habitsRes.data ?? []).map(row => ({ id: row.id as string, createdDay: toDateString(new Date(row.created_at as string)) }));
  if (habits.length === 0) return;

  const yesterday = addDays(today, -1);
  const earliest = habits.reduce((min, habit) => (habit.createdDay < min ? habit.createdDay : min), habits[0].createdDay);
  const last = lastRes.data?.[0]?.day as string | undefined;
  let start = last ? addDays(last, 1) : earliest;
  const floor = addDays(yesterday, -365);
  if (start < floor) start = floor;
  if (start > yesterday) return;

  const logs = await fetchAll<{ habit_id: string; completed_on: string }>((from, to) =>
    supabase.from('habit_logs').select('habit_id, completed_on').eq('user_id', userId).eq('completed', true).gte('completed_on', start).lte('completed_on', yesterday).range(from, to));
  const done = new Set(logs.map(log => `${log.habit_id}|${log.completed_on}`));

  const rows: { user_id: string; day: string; total: number; done: number; successful: boolean }[] = [];
  for (let day = start; day <= yesterday; day = addDays(day, 1)) {
    const active = habits.filter(habit => habit.createdDay <= day);
    if (active.length === 0) continue;
    const completed = active.filter(habit => done.has(`${habit.id}|${day}`)).length;
    rows.push({ user_id: userId, day, total: active.length, done: completed, successful: completed === active.length });
  }
  if (rows.length === 0) return;
  const saved = await supabase.from('habit_days').upsert(rows, { onConflict: 'user_id,day', ignoreDuplicates: true });
  if (saved.error) throw new Error(saved.error.message);
}

/** Cierra los días pendientes y devuelve el historial completo de días cerrados. */
export async function loadHabitHistory(userId: string, today: string): Promise<HabitDay[]> {
  await closePastDays(userId, today);
  const rows = await fetchAll<{ day: string; total: number; done: number; successful: boolean }>((from, to) =>
    supabase.from('habit_days').select('day, total, done, successful').eq('user_id', userId).order('day').range(from, to));
  return rows.map(row => ({ day: row.day, total: Number(row.total), done: Number(row.done), successful: row.successful }));
}
