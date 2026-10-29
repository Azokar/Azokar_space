import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { shortDate } from '../lib/fixedExpenses';
import { useToday } from '../lib/useToday';
import DatePickerField from '../components/DatePickerField';
import TaskCalendar, { type DayInfo } from '../components/TaskCalendar';
import { Button, Card, Checkbox, EmptyState, ErrorText, Field, Icon, Metric, SectionHeader, SkeletonList, Reveal } from '../components/ui';
import { colors, radius, space, type } from '../theme';

type Task = { id: string; title: string; details: string; scheduled_on: string; completed_at: string | null };
type TaskView = 'week' | 'month';
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function plusDays(day: string, offset: number) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + offset); return toKey(date); }
function mondayOf(day: string) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return toKey(date); }
const monthStartOf = (day: string) => `${day.slice(0, 7)}-01`;
const monthEndOf = (monthStart: string) => { const [y, m] = monthStart.split('-').map(Number); return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`; };
const addMonths = (monthStart: string, delta: number) => { const [y, m] = monthStart.split('-').map(Number); const date = new Date(y, m - 1 + delta, 1); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`; };
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function TasksScreen({ userId }: { userId: string }) {
  // "Hoy" se actualiza solo a medianoche: un día que termina con tareas pendientes pasa a rojo al instante.
  const today = useToday();
  const [view, setView] = useState<TaskView>('week');
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [monthStart, setMonthStart] = useState(() => monthStartOf(today));
  const week = useMemo(() => WEEKDAYS.map((label, index) => ({ label, date: plusDays(weekStart, index) })), [weekStart]);
  const [selectedDay, setSelectedDay] = useState(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<{ count: number; first: string | null }>({ count: 0, first: null });
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [newDate, setNewDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  // Rango visible: la semana o el mes completo, según la vista.
  const rangeStart = view === 'week' ? weekStart : monthStart;
  const rangeEnd = view === 'week' ? plusDays(weekStart, 6) : monthEndOf(monthStart);

  const load = useCallback(async () => {
    const [rangeRows, overdueRows] = await Promise.all([
      supabase.from('weekly_tasks').select('id, title, details, scheduled_on, completed_at').eq('user_id', userId).gte('scheduled_on', rangeStart).lte('scheduled_on', rangeEnd).order('scheduled_on').order('created_at'),
      supabase.from('weekly_tasks').select('scheduled_on', { count: 'exact' }).eq('user_id', userId).is('completed_at', null).lt('scheduled_on', today).order('scheduled_on').limit(1),
    ]);
    const failure = rangeRows.error ?? overdueRows.error;
    if (failure) setError(failure.message);
    else {
      setTasks((rangeRows.data ?? []) as Task[]);
      setOverdue({ count: overdueRows.count ?? 0, first: (overdueRows.data?.[0]?.scheduled_on as string | undefined) ?? null });
      setError('');
    }
    setLoading(false);
  }, [userId, rangeStart, rangeEnd, today]);
  useEffect(() => { void load(); }, [load]);

  const isOverdue = (task: Task) => task.completed_at === null && task.scheduled_on < today;
  const completed = tasks.filter(task => task.completed_at !== null).length;
  const pending = tasks.length - completed;
  const visibleTasks = tasks.filter(task => task.scheduled_on === selectedDay);
  const thisWeek = mondayOf(today);
  const thisMonth = monthStartOf(today);

  const info = useMemo(() => {
    const map = new Map<string, DayInfo>();
    tasks.forEach(task => { const entry = map.get(task.scheduled_on) ?? { total: 0, pending: 0 }; entry.total += 1; if (task.completed_at === null) entry.pending += 1; map.set(task.scheduled_on, entry); });
    return map;
  }, [tasks]);

  // Mantiene sincronizadas las dos vistas: al cambiar de una a otra se muestra el día seleccionado.
  const switchView = (next: TaskView) => {
    if (next === view) return;
    if (next === 'week') setWeekStart(mondayOf(selectedDay)); else setMonthStart(monthStartOf(selectedDay));
    setView(next);
  };
  const goToWeek = (monday: string) => { setWeekStart(monday); setSelectedDay(monday <= today && today <= plusDays(monday, 6) ? today : monday); };
  const goToMonth = (start: string) => { setMonthStart(start); setSelectedDay(start === thisMonth ? today : start); };
  const selectDay = (day: string) => { setSelectedDay(day); if (day >= today) setNewDate(day); };
  const jumpTo = (day: string) => { setWeekStart(mondayOf(day)); setMonthStart(monthStartOf(day)); setSelectedDay(day); };

  const addTask = async () => {
    if (!title.trim()) return setError('Escribe el nombre de la tarea.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate < today) return setError('Elige una fecha de hoy en adelante.');
    setBusyId('new'); setError('');
    const result = await supabase.from('weekly_tasks').insert({ user_id: userId, title: title.trim(), details: details.trim(), scheduled_on: newDate }).select('id').single();
    setBusyId('');
    if (result.error) { setError(result.error.message); return; }
    setTitle(''); setDetails('');
    jumpTo(newDate); // muestra la semana/mes y el día donde quedó la tarea
    await load();
  };
  const toggleTask = async (task: Task) => {
    setBusyId(task.id); setError('');
    const result = await supabase.from('weekly_tasks').update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq('id', task.id).eq('user_id', userId);
    setBusyId('');
    if (result.error) setError(result.error.message); else await load();
  };

  const selectedIndex = week.findIndex(day => day.date === selectedDay);
  const dayName = WEEKDAYS[(new Date(`${selectedDay}T12:00:00`).getDay() + 6) % 7];
  const selectedTitle = selectedDay === today ? 'Hoy' : `${selectedIndex >= 0 || view === 'month' ? dayName : ''} ${shortDate(selectedDay)}`.trim();

  return <View>
    <View style={styles.segment}>{([['week', 'Semana', 'list'], ['month', 'Calendario', 'calendar']] as const).map(([value, label, icon]) => <TouchableOpacity key={value} activeOpacity={0.8} onPress={() => switchView(value)} style={[styles.segmentItem, view === value && styles.segmentSelected]} accessibilityRole="tab" accessibilityState={{ selected: view === value }}>
      <Icon name={icon} size={15} color={view === value ? colors.accent : colors.muted} /><Text style={[styles.segmentText, view === value && styles.segmentTextSelected]}>{label}</Text>
    </TouchableOpacity>)}</View>

    <View style={styles.metricsRow}><Metric value={String(tasks.length)} label="Programadas" /><Metric value={String(pending)} label="Pendientes" /><Metric value={String(completed)} label="Completadas" accent /></View>

    {overdue.count > 0 && <TouchableOpacity activeOpacity={0.8} onPress={() => overdue.first && jumpTo(overdue.first)} style={styles.alert} accessibilityLabel="Ver tareas vencidas">
      <Icon name="alert-circle" size={18} color={colors.danger} />
      <View style={{ flex: 1 }}><Text style={styles.alertTitle}>{overdue.count} {overdue.count === 1 ? 'tarea vencida' : 'tareas vencidas'}</Text><Text style={styles.alertText}>Quedaron sin completar en días anteriores. Toca para verlas.</Text></View>
      <Icon name="chevron-right" size={16} color={colors.danger} />
    </TouchableOpacity>}

    {view === 'week' ? <>
      <View style={styles.periodHeader}>
        <TouchableOpacity onPress={() => goToWeek(plusDays(weekStart, -7))} hitSlop={10} style={styles.nav} accessibilityLabel="Semana anterior"><Icon name="chevron-left" size={18} color={colors.ink} /></TouchableOpacity>
        <View style={styles.periodTitleWrap}>
          <Text style={styles.periodTitle}>{weekStart === thisWeek ? 'Esta semana' : weekStart > thisWeek ? 'Semana próxima' : 'Semana anterior'}</Text>
          <Text style={type.caption}>{shortDate(weekStart)} — {shortDate(plusDays(weekStart, 6))}</Text>
        </View>
        {weekStart !== thisWeek && <TouchableOpacity onPress={() => goToWeek(thisWeek)} hitSlop={8} style={styles.todayChip} accessibilityLabel="Volver a esta semana"><Text style={styles.todayChipText}>Hoy</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => goToWeek(plusDays(weekStart, 7))} hitSlop={10} style={styles.nav} accessibilityLabel="Semana siguiente"><Icon name="chevron-right" size={18} color={colors.ink} /></TouchableOpacity>
      </View>

      <View style={styles.dayRow}>{week.map(day => {
        const data = info.get(day.date);
        const late = day.date < today && !!data && data.pending > 0; // día pasado con tareas sin hacer
        const chosen = selectedDay === day.date;
        return <TouchableOpacity key={day.date} activeOpacity={0.8} style={[styles.day, day.date === today && styles.dayToday, late && styles.dayLate, chosen && (late ? styles.dayLateSelected : styles.daySelected)]} onPress={() => selectDay(day.date)} accessibilityLabel={`${day.label} ${day.date}${late ? ', con tareas vencidas' : ''}`}>
          <Text style={[styles.dayLabel, chosen && styles.dayAccent, late && styles.dayRed]}>{day.label.toUpperCase()}</Text>
          <Text style={[styles.dayNumber, chosen && styles.dayAccent, late && styles.dayRed]}>{day.date.slice(-2)}</Text>
          <View style={[styles.dayDot, !!data && styles.dayDotActive, late && styles.dayDotLate]} />
        </TouchableOpacity>;
      })}</View>
    </> : <>
      <View style={styles.periodHeader}>
        <TouchableOpacity onPress={() => goToMonth(addMonths(monthStart, -1))} hitSlop={10} style={styles.nav} accessibilityLabel="Mes anterior"><Icon name="chevron-left" size={18} color={colors.ink} /></TouchableOpacity>
        <View style={styles.periodTitleWrap}>
          <Text style={styles.periodTitle}>{MONTHS[Number(monthStart.slice(5, 7)) - 1]} {monthStart.slice(0, 4)}</Text>
          <Text style={type.caption}>Toca un día para ver o agendar tareas</Text>
        </View>
        {monthStart !== thisMonth && <TouchableOpacity onPress={() => goToMonth(thisMonth)} hitSlop={8} style={styles.todayChip} accessibilityLabel="Volver a este mes"><Text style={styles.todayChipText}>Hoy</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => goToMonth(addMonths(monthStart, 1))} hitSlop={10} style={styles.nav} accessibilityLabel="Mes siguiente"><Icon name="chevron-right" size={18} color={colors.ink} /></TouchableOpacity>
      </View>
      <TaskCalendar monthStart={monthStart} today={today} selectedDay={selectedDay} info={info} onSelect={selectDay} />
    </>}

    <SectionHeader title={selectedTitle} meta={`${visibleTasks.length} ${visibleTasks.length === 1 ? 'tarea' : 'tareas'}`} />
    {loading ? <SkeletonList count={3} rowHeight={62} /> : visibleTasks.length === 0
      ? <EmptyState icon="moon" text={selectedDay < today ? 'No había tareas este día.' : 'Nada programado este día. Añade una actividad abajo.'} />
      : visibleTasks.map((task, index) => {
        const late = isOverdue(task);
        return <Reveal key={task.id} index={index}><TouchableOpacity activeOpacity={0.8} style={[styles.taskRow, late && styles.taskRowLate]} onPress={() => toggleTask(task)} disabled={busyId === task.id}>
          <Checkbox done={task.completed_at !== null} busy={busyId === task.id} />
          <View style={styles.taskCopy}>
            <Text style={[styles.taskTitle, task.completed_at && styles.taskComplete]}>{task.title}</Text>
            {task.details ? <Text style={styles.taskDetails}>{task.details}</Text> : null}
          </View>
          <Text style={[styles.toggleText, late && { color: colors.danger }]}>{task.completed_at ? 'Deshacer' : late ? 'Vencida' : 'Completar'}</Text>
        </TouchableOpacity></Reveal>;
      })}

    <SectionHeader title="Añadir actividad" />
    <Card>
      <Field value={title} onChangeText={setTitle} placeholder="¿Qué necesitas hacer?" style={{ marginTop: 0 }} />
      <Field value={details} onChangeText={setDetails} placeholder="Detalle (opcional)" />
      <DatePickerField label="FECHA" value={newDate} onChange={setNewDate} minDate={today} />
      <Button label="Añadir tarea" icon="plus" onPress={addTask} busy={busyId === 'new'} />
    </Card>
    <ErrorText>{error}</ErrorText>
  </View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, marginBottom: space.lg },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.accentGlow },
  segmentText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  segmentTextSelected: { color: colors.accent },
  metricsRow: { flexDirection: 'row', gap: space.sm },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255, 138, 155, 0.5)', backgroundColor: colors.dangerSoft },
  alertTitle: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  alertText: { ...type.caption, marginTop: 2, fontSize: 12 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  periodTitleWrap: { flex: 1 },
  periodTitle: { ...type.heading },
  nav: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  todayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  todayChipText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  dayToday: { borderColor: colors.lineStrong },
  daySelected: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  dayLate: { backgroundColor: colors.dangerSoft, borderColor: 'rgba(255, 138, 155, 0.5)' },
  dayLateSelected: { borderColor: colors.danger, backgroundColor: 'rgba(255, 138, 155, 0.2)' },
  dayLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  dayNumber: { color: colors.ink, fontSize: 17, fontWeight: '300', marginTop: 6 },
  dayAccent: { color: colors.accent },
  dayRed: { color: colors.danger },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 7 },
  dayDotActive: { backgroundColor: colors.accent },
  dayDotLate: { backgroundColor: colors.danger },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: space.lg, marginBottom: space.sm },
  taskRowLate: { borderColor: 'rgba(255, 138, 155, 0.5)', backgroundColor: 'rgba(255, 138, 155, 0.06)' },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.ink, fontSize: 14 },
  taskDetails: { ...type.caption, marginTop: 4 },
  taskComplete: { textDecorationLine: 'line-through', color: colors.muted },
  toggleText: { ...type.caption, fontSize: 12 },
});
