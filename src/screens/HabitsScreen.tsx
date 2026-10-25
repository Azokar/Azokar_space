import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dailyHabitProgress, weeklyHabitProgress } from '../lib/habits';
import { supabase } from '../lib/supabase';
import { Button, Card, Checkbox, Chip, EmptyState, ErrorText, Field, Metric, ProgressBar, SectionHeader } from '../components/ui';
import { colors, space, type } from '../theme';

type HabitRow = { id: string; name: string; scheduled_days: number[] };
type LogRow = { habit_id: string; completed: boolean; completed_on: string };
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const todayString = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
function mondayOf(dateString: string) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }

export default function HabitsScreen({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [name, setName] = useState('');
  const [scheduledDays, setScheduledDays] = useState([1,2,3,4,5,6,7]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const today = useMemo(todayString, []);
  const monday = useMemo(() => mondayOf(today), [today]);

  const load = useCallback(async () => {
    const [habitResult, logResult] = await Promise.all([
      supabase.from('habits').select('id, name, scheduled_days').eq('user_id', userId).eq('is_active', true).order('created_at'),
      supabase.from('habit_logs').select('habit_id, completed, completed_on').eq('user_id', userId).gte('completed_on', monday).lte('completed_on', today),
    ]);
    const firstError = habitResult.error ?? logResult.error;
    if (firstError) setError(firstError.message);
    else { setHabits((habitResult.data ?? []) as HabitRow[]); setLogs((logResult.data ?? []) as LogRow[]); setError(''); }
    setLoading(false);
  }, [userId, monday, today]);
  useEffect(() => { void load(); }, [load]);

  const daily = dailyHabitProgress(habits.map(h => ({ id: h.id, scheduledDays: h.scheduled_days })), logs.map(l => ({ habitId: l.habit_id, completed: l.completed, completedOn: l.completed_on })), today);
  const weekly = weeklyHabitProgress(habits.map(h => ({ id: h.id, scheduledDays: h.scheduled_days })), logs.map(l => ({ habitId: l.habit_id, completed: l.completed, completedOn: l.completed_on })), monday);
  const todayWeekday = ((new Date(`${today}T12:00:00`).getDay() + 6) % 7) + 1;
  const todaysHabits = habits.filter(h => h.scheduled_days.includes(todayWeekday));

  const toggle = async (habit: HabitRow) => {
    setBusyId(habit.id); setError('');
    const wasDone = logs.some(log => log.habit_id === habit.id && log.completed_on === today && log.completed);
    const result = await supabase.from('habit_logs').upsert({ user_id: userId, habit_id: habit.id, completed_on: today, completed: !wasDone }, { onConflict: 'habit_id,completed_on' });
    setBusyId('');
    if (result.error) setError(result.error.message); else await load();
  };
  const addHabit = async () => {
    if (!name.trim()) return setError('Escribe el nombre del hábito.');
    if (!scheduledDays.length) return setError('Selecciona al menos un día.');
    setBusyId('new'); setError('');
    const result = await supabase.from('habits').insert({ user_id: userId, name: name.trim(), scheduled_days: scheduledDays }).select('id').single();
    setBusyId('');
    if (result.error) setError(result.error.message); else { setName(''); setScheduledDays([1,2,3,4,5,6,7]); await load(); }
  };

  return <View>
    <View style={styles.metricsRow}><Metric value={`${daily.percent}%`} label="Cumplimiento hoy" accent={daily.successful} /><Metric value={daily.successful ? 'Sí' : 'Aún no'} label="Día exitoso · 80%" /></View>
    <Card glow={weekly.successful} style={{ marginTop: space.md }}>
      <View style={styles.weekHeader}><Text style={type.overline}>PROGRESO SEMANAL</Text><Text style={styles.weekPercent}>{weekly.percent}%</Text></View>
      <View style={{ marginTop: space.md }}><ProgressBar percent={weekly.percent} /></View>
      <Text style={[type.caption, { marginTop: space.md }]}>{weekly.successful ? 'Semana exitosa. Órbita estable.' : `${weekly.activeDays} días con hábitos programados · objetivo 80%`}</Text>
    </Card>

    <SectionHeader title="Hábitos de hoy" meta={`${daily.done}/${daily.scheduled} hechos`} />
    {loading ? <ActivityIndicator color={colors.accent} style={{ margin: 24 }} /> : todaysHabits.length === 0
      ? <EmptyState icon="sunrise" text="No hay hábitos programados para hoy. Crea uno abajo." />
      : todaysHabits.map(habit => {
        const done = logs.some(log => log.habit_id === habit.id && log.completed_on === today && log.completed);
        return <TouchableOpacity key={habit.id} activeOpacity={0.8} style={[styles.row, done && styles.rowDone]} onPress={() => toggle(habit)} disabled={busyId === habit.id}>
          <Checkbox done={done} busy={busyId === habit.id} round />
          <Text style={[styles.rowName, done && styles.rowNameDone]}>{habit.name}</Text>
          <Text style={styles.rowHint}>{done ? 'Hecho' : 'Marcar'}</Text>
        </TouchableOpacity>;
      })}

    <SectionHeader title="Crear hábito" />
    <Card>
      <Field value={name} onChangeText={setName} placeholder="Ej. Leer 20 minutos" style={{ marginTop: 0 }} />
      <Text style={[type.overline, { marginTop: space.lg, marginBottom: space.sm }]}>DÍAS</Text>
      <View style={styles.daysRow}>{DAY_LABELS.map((day, index) => { const value = index + 1; const selected = scheduledDays.includes(value); return <Chip key={day} round label={day} selected={selected} onPress={() => setScheduledDays(current => selected ? current.filter(item => item !== value) : [...current, value].sort())} />; })}</View>
      <Button label="Añadir hábito" icon="plus" onPress={addHabit} busy={busyId === 'new'} />
    </Card>
    <ErrorText>{error}</ErrorText>
  </View>;
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: 'row', gap: space.md },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekPercent: { color: colors.accent, fontSize: 22, fontWeight: '300' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 18, paddingVertical: 14, paddingHorizontal: space.lg, marginBottom: space.sm },
  rowDone: { backgroundColor: 'transparent' },
  rowName: { flex: 1, color: colors.ink, fontSize: 14 },
  rowNameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  rowHint: { ...type.caption, fontSize: 11 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
