export type GoalLike = { target_amount: number; current_amount: number };

const cents = (value: number) => Math.round(value * 100) / 100;

/** Resumen de todas las metas: lo ahorrado (sin contar excedentes), lo que falta y cuántas están cumplidas. */
export function goalsOverview(goals: GoalLike[]) {
  const target = cents(goals.reduce((sum, goal) => sum + Number(goal.target_amount), 0));
  const saved = cents(goals.reduce((sum, goal) => sum + Math.min(Number(goal.current_amount), Number(goal.target_amount)), 0));
  return {
    count: goals.length,
    target,
    saved,
    missing: cents(Math.max(0, target - saved)),
    percent: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
    completed: goals.filter(goal => Number(goal.current_amount) >= Number(goal.target_amount)).length,
  };
}
