export type Habit = { id: string };
export type HabitLog = { habitId: string; completed: boolean; completedOn: string };

/**
 * Progreso de un día. Los hábitos activos aplican todos los días por igual y el día se reinicia solo,
 * porque el estado sale de los registros de esa fecha. Un día es exitoso cuando se completan todos.
 */
export function dailyHabitProgress(habits: Habit[], logs: HabitLog[], day: string) {
  const done = habits.filter(h => logs.some(l => l.habitId === h.id && l.completedOn === day && l.completed)).length;
  const total = habits.length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
}
