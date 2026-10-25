import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Card, Checkbox, EmptyState, ErrorText, Field, Metric, SectionHeader } from '../components/ui';
import { colors, space, type } from '../theme';

type Task = { id: string; title: string; details: string; scheduled_on: string; completed_at: string | null };
const todayString = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
function plusDays(day: string, offset: number) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function mondayOf(day: string) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function TasksScreen({ userId }: { userId: string }) {
  const today = useMemo(todayString, []);
  const monday = useMemo(() => mondayOf(today), [today]);
  const week = useMemo(() => WEEKDAYS.map((label, index) => ({ label, date: plusDays(monday, index) })), [monday]);
  const [selectedDay, setSelectedDay] = useState(today >= monday && today <= plusDays(monday, 6) ? today : monday);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('weekly_tasks').select('id, title, details, scheduled_on, completed_at').eq('user_id', userId).gte('scheduled_on', monday).lte('scheduled_on', plusDays(monday, 6)).order('scheduled_on').order('created_at');
    if (queryError) setError(queryError.message); else { setTasks((data ?? []) as Task[]); setError(''); }
    setLoading(false);
  }, [userId, monday]);
  useEffect(() => { void load(); }, [load]);

  const completed = tasks.filter(task => task.completed_at !== null).length;
  const pending = tasks.length - completed;
  const visibleTasks = tasks.filter(task => task.scheduled_on === selectedDay);

  const addTask = async () => {
    if (!title.trim()) return setError('Escribe el nombre de la tarea.');
    setBusyId('new'); setError('');
    const result = await supabase.from('weekly_tasks').insert({ user_id: userId, title: title.trim(), details: details.trim(), scheduled_on: selectedDay }).select('id').single();
    setBusyId('');
    if (result.error) setError(result.error.message); else { setTitle(''); setDetails(''); await load(); }
  };
  const toggleTask = async (task: Task) => {
    setBusyId(task.id); setError('');
    const result = await supabase.from('weekly_tasks').update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq('id', task.id).eq('user_id', userId);
    setBusyId('');
    if (result.error) setError(result.error.message); else await load();
  };

  return <View>
    <View style={styles.metricsRow}><Metric value={String(tasks.length)} label="Programadas" /><Metric value={String(pending)} label="Pendientes" /><Metric value={String(completed)} label="Completadas" accent /></View>

    <SectionHeader title="Semana" meta={`${monday.slice(5)} — ${plusDays(monday, 6).slice(5)}`} />
    <View style={styles.dayRow}>{week.map(day => {
      const count = tasks.filter(task => task.scheduled_on === day.date).length;
      const chosen = selectedDay === day.date;
      return <TouchableOpacity key={day.date} activeOpacity={0.8} style={[styles.day, chosen && styles.daySelected]} onPress={() => setSelectedDay(day.date)}>
        <Text style={[styles.dayLabel, chosen && styles.dayAccent]}>{day.label.toUpperCase()}</Text>
        <Text style={[styles.dayNumber, chosen && styles.dayAccent]}>{day.date.slice(-2)}</Text>
        <View style={[styles.dayDot, count > 0 && styles.dayDotActive]} />
      </TouchableOpacity>;
    })}</View>

    <SectionHeader title={selectedDay === today ? 'Hoy' : WEEKDAYS[week.findIndex(day => day.date === selectedDay)]} meta={`${visibleTasks.length} programadas`} />
    {loading ? <ActivityIndicator color={colors.accent} style={{ margin: 24 }} /> : visibleTasks.length === 0
      ? <EmptyState icon="moon" text="Nada programado este día. Añade una actividad abajo." />
      : visibleTasks.map(task => <TouchableOpacity key={task.id} activeOpacity={0.8} style={styles.taskRow} onPress={() => toggleTask(task)} disabled={busyId === task.id}>
        <Checkbox done={task.completed_at !== null} busy={busyId === task.id} />
        <View style={styles.taskCopy}>
          <Text style={[styles.taskTitle, task.completed_at && styles.taskComplete]}>{task.title}</Text>
          {task.details ? <Text style={styles.taskDetails}>{task.details}</Text> : null}
        </View>
        <Text style={styles.toggleText}>{task.completed_at ? 'Deshacer' : 'Completar'}</Text>
      </TouchableOpacity>)}

    <SectionHeader title="Añadir actividad" />
    <Card>
      <Field value={title} onChangeText={setTitle} placeholder="¿Qué necesitas hacer?" style={{ marginTop: 0 }} />
      <Field value={details} onChangeText={setDetails} placeholder="Detalle (opcional)" />
      <Button label={`Programar para ${selectedDay}`} icon="plus" onPress={addTask} busy={busyId === 'new'} />
    </Card>
    <ErrorText>{error}</ErrorText>
  </View>;
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: 'row', gap: space.sm },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  daySelected: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  dayLabel: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  dayNumber: { color: colors.ink, fontSize: 17, fontWeight: '300', marginTop: 6 },
  dayAccent: { color: colors.accent },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 7 },
  dayDotActive: { backgroundColor: colors.accent },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: space.lg, marginBottom: space.sm },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.ink, fontSize: 14 },
  taskDetails: { ...type.caption, marginTop: 4 },
  taskComplete: { textDecorationLine: 'line-through', color: colors.muted },
  toggleText: { ...type.caption, fontSize: 11 },
});
