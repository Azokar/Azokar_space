export type Habit = { id: string; scheduledDays: number[] };
export type HabitLog = { habitId: string; completed: boolean; completedOn: string };

// ISO weekday: Monday=1 ... Sunday=7.
export function dailyHabitProgress(habits: Habit[], logs: HabitLog[], day: string) {
  const weekday = ((new Date(`${day}T12:00:00`).getDay() + 6) % 7) + 1;
  const scheduled = habits.filter(h => h.scheduledDays.includes(weekday));
  const done = scheduled.filter(h => logs.some(l => l.habitId === h.id && l.completedOn === day && l.completed)).length;
  const percent = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
  return { scheduled: scheduled.length, done, percent, successful: scheduled.length > 0 && percent >= 80 };
}

// Mean of daily completion rates for days that have at least one scheduled habit.
export function weeklyHabitProgress(habits: Habit[], logs: HabitLog[], monday: string) {
  const start = new Date(`${monday}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const daily = days.map(day => dailyHabitProgress(habits, logs, day)).filter(day => day.scheduled > 0);
  const percent = daily.length ? Math.round(daily.reduce((sum, day) => sum + day.percent, 0) / daily.length) : 0;
  return { percent, successful: daily.length > 0 && percent >= 80, activeDays: daily.length };
}
