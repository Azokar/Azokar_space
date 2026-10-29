import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { dailyHabitProgress } from '../lib/habits';
import { habitStats, loadHabitHistory, POINTS_FAIL, POINTS_SUCCESS, type HabitDay } from '../lib/habitPoints';
import { useToday } from '../lib/useToday';
import { supabase } from '../lib/supabase';
import MoonProgress from '../components/MoonProgress';
import { Button, Card, Checkbox, EmptyState, ErrorText, Field, Icon, Metric, SectionHeader, SkeletonList } from '../components/ui';
import { colors, space, type } from '../theme';

type HabitRow = { id: string; name: string };
type LogRow = { habit_id: string; completed: boolean; completed_on: string };

export default function HabitsScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const today = useToday();
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [history, setHistory] = useState<HabitDay[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');

  // Todo se recarga cuando cambia el día: a las 00:00 los hábitos vuelven a "pendiente" y el día anterior se cierra.
  const load = useCallback(async () => {
    const [habitResult, logResult] = await Promise.all([
      supabase.from('habits').select('id, name').eq('user_id', userId).eq('is_active', true).order('created_at'),
      supabase.from('habit_logs').select('habit_id, completed, completed_on').eq('user_id', userId).eq('completed_on', today),
    ]);
    const firstError = habitResult.error ?? logResult.error;
    if (firstError) setError(firstError.message);
    else { setHabits((habitResult.data ?? []) as HabitRow[]); setLogs((logResult.data ?? []) as LogRow[]); setError(''); }
    setLoading(false);
    try { setHistory(await loadHabitHistory(userId, today)); setHistoryError(''); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo cargar el historial.';
      setHistoryError(/habit_days|schema cache|does not exist|relation/i.test(message) ? 'Falta la tabla de días de hábitos. Ejecuta supabase/migrations/20261028_habit_days.sql en Supabase.' : message);
    }
  }, [userId, today]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const progress = useMemo(() => dailyHabitProgress(habits.map(h => ({ id: h.id })), logs.map(l => ({ habitId: l.habit_id, completed: l.completed, completedOn: l.completed_on })), today), [habits, logs, today]);
  const stats = useMemo(() => habitStats(history), [history]);
  const remaining = progress.total - progress.done;

  const hint = progress.total === 0
    ? `+${POINTS_SUCCESS} por día completo · −${POINTS_FAIL} por día incompleto`
    : progress.complete
      ? `Hoy lo completaste todo: sumarás +${POINTS_SUCCESS} al cerrar el día.`
      : `Completa ${remaining === 1 ? 'el hábito que falta' : `los ${remaining} hábitos que faltan`} antes de medianoche para sumar +${POINTS_SUCCESS}; si no, restarás ${POINTS_FAIL}.`;

  const toggle = async (habit: HabitRow) => {
    setBusyId(habit.id); setError('');
    const wasDone = logs.some(log => log.habit_id === habit.id && log.completed);
    const result = await supabase.from('habit_logs').upsert({ user_id: userId, habit_id: habit.id, completed_on: today, completed: !wasDone }, { onConflict: 'habit_id,completed_on' });
    setBusyId('');
    if (result.error) setError(result.error.message); else await load();
  };
  const addHabit = async () => {
    if (!name.trim()) return setError('Escribe el nombre del hábito.');
    setBusyId('new'); setError('');
    const result = await supabase.from('habits').insert({ user_id: userId, name: name.trim() }).select('id').single();
    setBusyId('');
    if (result.error) setError(result.error.message); else { setName(''); await load(); }
  };

  return <View>
    <MoonProgress points={stats.points} hint={hint} />
    <ErrorText>{historyError}</ErrorText>

    <View style={styles.metricsRow}>
      <Metric value={`${progress.done}/${progress.total}`} label="Completados hoy" accent={progress.complete} />
      <Metric value={String(stats.successful)} label="Días exitosos" />
    </View>
    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/habitos-estadisticas')} style={styles.statsLink} accessibilityLabel="Ver estadísticas de hábitos">
      <Icon name="bar-chart-2" size={16} color={colors.accent} /><Text style={styles.statsLinkText}>Ver estadísticas de días exitosos</Text><View style={{ flex: 1 }} /><Icon name="chevron-right" size={16} color={colors.muted} />
    </TouchableOpacity>

    <SectionHeader title="Hábitos de hoy" meta={progress.total > 0 ? `${progress.done}/${progress.total} hechos` : undefined} />
    {loading ? <SkeletonList count={3} rowHeight={54} /> : habits.length === 0
      ? <EmptyState icon="sunrise" text="Aún no tienes hábitos. Crea el primero abajo; se aplican todos los días." />
      : habits.map(habit => {
        const done = logs.some(log => log.habit_id === habit.id && log.completed);
        return <TouchableOpacity key={habit.id} activeOpacity={0.8} style={[styles.row, done && styles.rowDone]} onPress={() => toggle(habit)} disabled={busyId === habit.id} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
          <Checkbox done={done} busy={busyId === habit.id} round />
          <Text style={[styles.rowName, done && styles.rowNameDone]}>{habit.name}</Text>
          <Text style={styles.rowHint}>{done ? 'Hecho' : 'Pendiente'}</Text>
        </TouchableOpacity>;
      })}

    <SectionHeader title="Crear hábito" />
    <Card>
      <Field value={name} onChangeText={setName} placeholder="Ej. Leer 20 minutos" style={{ marginTop: 0 }} />
      <Text style={[type.caption, { marginTop: space.md }]}>Los hábitos se aplican todos los días y se reinician a las 00:00.</Text>
      <Button label="Añadir hábito" icon="plus" onPress={addHabit} busy={busyId === 'new'} />
    </Card>
    <ErrorText>{error}</ErrorText>
  </View>;
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  statsLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingVertical: 14, paddingHorizontal: space.lg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.surface },
  statsLinkText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 18, paddingVertical: 14, paddingHorizontal: space.lg, marginBottom: space.sm },
  rowDone: { backgroundColor: 'transparent' },
  rowName: { flex: 1, color: colors.ink, fontSize: 14 },
  rowNameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  rowHint: { ...type.caption, fontSize: 12 },
});
