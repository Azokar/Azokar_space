import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dailyHabitProgress } from '../lib/habits';
import { supabase } from '../lib/supabase';
import MoneyBreakdownCard from '../components/MoneyBreakdownCard';
import { Card, EmptyState, ErrorText, Icon, ProgressBar, SectionHeader, type IconName, SkeletonList } from '../components/ui';
import { colors, money, radius, space, type } from '../theme';

type Habit = { id: string };
type Log = { habit_id: string; completed: boolean; completed_on: string };
type Task = { id: string; title: string; scheduled_on: string; completed_at: string | null };
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };
const monday = (day: string) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate()-((date.getDay()+6)%7)); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
const shift = (day: string, n: number) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate()+n); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };

export default function DashboardScreen({ userId, onNavigate }: { userId: string; onNavigate: (tab: string) => void }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const day = today();
  const startWeek = monday(day);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('habits').select('id').eq('user_id', userId).eq('is_active', true),
      supabase.from('habit_logs').select('habit_id, completed, completed_on').eq('user_id', userId).gte('completed_on', startWeek).lte('completed_on', day),
      supabase.from('weekly_tasks').select('id, title, scheduled_on, completed_at').eq('user_id', userId).gte('scheduled_on', startWeek).lte('scheduled_on', shift(startWeek,6)).order('scheduled_on'),
      // Pendientes: las vencidas (días anteriores) primero y luego las de los próximos 14 días.
      supabase.from('weekly_tasks').select('id, title, scheduled_on, completed_at').eq('user_id', userId).is('completed_at', null).lte('scheduled_on', shift(day, 14)).order('scheduled_on').limit(4),
    ]).then(([habitRows, logRows, taskRows, upcomingRows]) => {
      if (!active) return;
      const err = habitRows.error ?? logRows.error ?? taskRows.error ?? upcomingRows.error;
      if (err) setError(err.message);
      else { setHabits((habitRows.data ?? []) as Habit[]); setLogs((logRows.data ?? []) as Log[]); setTasks((taskRows.data ?? []) as Task[]); setUpcoming((upcomingRows.data ?? []) as Task[]); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId, day, startWeek]);

  const daily = dailyHabitProgress(habits.map(item => ({ id:item.id })), logs.map(item => ({ habitId:item.habit_id, completed:item.completed, completedOn:item.completed_on })), day);
  const completed = tasks.filter(item => item.completed_at !== null).length;

  return <View>
    <MoneyBreakdownCard userId={userId} />

    <SectionHeader title="Accesos rápidos" />
    <View style={styles.quickRow}>
      <Quick label="Gasto" icon="minus" onPress={() => onNavigate('Finanzas')} />
      <Quick label="Hábito" icon="check" onPress={() => onNavigate('Hábitos')} />
      <Quick label="Tarea" icon="plus" onPress={() => onNavigate('Tareas')} />
    </View>

    <View style={styles.summaryRow}>
      <TouchableOpacity activeOpacity={0.8} style={styles.summaryTouch} onPress={() => onNavigate('Hábitos')}>
        <Card><Text style={type.overline}>HÁBITOS HOY</Text><Text style={styles.summaryValue}>{loading ? '—' : `${daily.percent}%`}</Text><ProgressBar percent={loading ? 0 : daily.percent} /><Text style={styles.summaryHint}>{daily.complete ? 'Día completo' : `${daily.done}/${daily.total} completados`}</Text></Card>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} style={styles.summaryTouch} onPress={() => onNavigate('Tareas')}>
        <Card><Text style={type.overline}>TAREAS · SEMANA</Text><Text style={styles.summaryValue}>{loading ? '—' : `${completed}/${tasks.length}`}</Text><ProgressBar percent={tasks.length ? (completed / tasks.length) * 100 : 0} /><Text style={styles.summaryHint}>{Math.max(0,tasks.length-completed)} pendientes</Text></Card>
      </TouchableOpacity>
    </View>

    <SectionHeader title="Tareas próximas" action="Ver tareas" onAction={() => onNavigate('Tareas')} />
    {loading ? <SkeletonList count={3} rowHeight={52} /> : upcoming.length === 0
      ? <EmptyState icon="moon" text="Sin tareas pendientes. Un cielo despejado." />
      : <Card style={styles.list}>{upcoming.map((task, index) => {
        const late = task.scheduled_on < day; // día pasado sin completar
        return <TouchableOpacity key={task.id} activeOpacity={0.7} style={[styles.taskRow, index > 0 && styles.taskDivider]} onPress={() => onNavigate('Tareas')}>
          <View style={[styles.dot, late && styles.dotLate]} />
          <Text style={[styles.taskTitle, late && styles.taskTitleLate]} numberOfLines={1}>{task.title}</Text>
          <Text style={[styles.taskDate, late && styles.taskTitleLate]}>{late ? 'Vencida · ' : ''}{task.scheduled_on.slice(5)}</Text>
        </TouchableOpacity>;
      })}</Card>}
    <ErrorText>{error}</ErrorText>
  </View>;
}

function Quick({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return <TouchableOpacity activeOpacity={0.8} style={styles.quick} onPress={onPress}><View style={styles.quickIcon}><Icon name={icon} size={20} color={colors.accent} /></View><Text style={styles.quickLabel}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  balanceCard: { paddingVertical: space.xl },
  balance: { color: colors.ink, fontSize: 44, fontWeight: '200', letterSpacing: -1.5, marginTop: space.md },
  flowRow: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowText: { color: colors.inkSoft, fontSize: 13, fontWeight: '500' },
  quickRow: { flexDirection: 'row', gap: space.md },
  quick: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.surface },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentGlow, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  summaryTouch: { flex: 1 },
  summaryValue: { color: colors.ink, fontSize: 30, fontWeight: '300', letterSpacing: -0.8, marginVertical: space.md },
  summaryHint: { ...type.caption, marginTop: space.md },
  list: { paddingVertical: 4, paddingHorizontal: space.lg },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: space.md },
  taskDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent },
  dotDone: { backgroundColor: colors.accent },
  dotLate: { borderColor: colors.danger, backgroundColor: colors.danger },
  taskTitleLate: { color: colors.danger },
  taskTitle: { flex: 1, color: colors.ink, fontSize: 14 },
  taskDone: { textDecorationLine: 'line-through', color: colors.muted },
  taskDate: { ...type.caption, fontVariant: ['tabular-nums'] },
});
