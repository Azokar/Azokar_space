import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useToday } from '../lib/useToday';
import { METRIC_LABELS, NO_CATEGORY, NO_DAY, dailySeries, exerciseStats, formatDateTime, formatNumber, formatSet, formatWeight, relativeDay, volumeOf, type Exercise, type ExerciseLog, type Metric } from '../lib/workouts';
import ConfirmSheet from '../components/ConfirmSheet';
import ExerciseForm from '../components/ExerciseForm';
import FormSheet from '../components/FormSheet';
import LineChart from '../components/LineChart';
import LogForm, { parseLog } from '../components/LogForm';
import { Card, Chevron, Chip, ChipRow, Collapsible, EmptyState, ErrorText, Icon, Metric as MetricCard, SectionHeader, SkeletonList } from '../components/ui';
import { colors, space, type } from '../theme';

const METRICS: Metric[] = ['weight', 'reps', 'volume'];
const UNITS: Record<Metric, string> = { weight: 'kg', reps: 'reps', volume: 'kg·reps' };

/** Detalle de un ejercicio: registrar series, ver la evolución en el tiempo y el historial con fecha y hora. */
export default function ExerciseDetailScreen({ userId, exerciseId, onBack }: { userId: string; exerciseId: string; onBack: () => void }) {
  const today = useToday();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dayLabels, setDayLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState('');
  // Confirmación visible del último registro guardado, con opción de deshacerlo (evita duplicados por pulsar de nuevo).
  const [saved, setSaved] = useState<{ id: string; text: string } | null>(null);
  const [metric, setMetric] = useState<Metric>('weight');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'exercise' } | { kind: 'log'; log: ExerciseLog } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const load = useCallback(async () => {
    const [exerciseRow, logRows, allExercises] = await Promise.all([
      supabase.from('exercises').select('id, name, category, day_label, created_at').eq('user_id', userId).eq('id', exerciseId).maybeSingle(),
      supabase.from('exercise_logs').select('id, exercise_id, weight, reps, logged_at').eq('user_id', userId).eq('exercise_id', exerciseId).order('logged_at', { ascending: false }).limit(1000),
      supabase.from('exercises').select('category, day_label').eq('user_id', userId),
    ]);
    const failure = exerciseRow.error ?? logRows.error;
    if (failure) setError(failure.message);
    else {
      setExercise((exerciseRow.data as Exercise | null) ?? null);
      setLogs((logRows.data ?? []) as ExerciseLog[]);
      const rows = (allExercises.data ?? []) as { category: string; day_label: string }[];
      setCategories([...new Set(rows.map(row => row.category.trim()).filter(Boolean))]);
      setDayLabels([...new Set(rows.map(row => row.day_label.trim()).filter(Boolean))]);
      setError('');
    }
    setLoading(false);
  }, [userId, exerciseId]);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => exerciseStats(logs), [logs]);
  const series = useMemo(() => dailySeries(logs, metric), [logs, metric]);
  const picked = series.find(point => point.key === selectedKey);
  const last = logs[0];

  // Los campos del formulario arrancan con la última serie, que es lo más común al repetir una rutina.
  useEffect(() => { if (last && weight === '' && reps === '') { setWeight(String(last.weight)); setReps(String(last.reps)); } }, [last]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLog = async () => {
    const parsed = parseLog(weight, reps);
    if (typeof parsed === 'string') return setLogError(parsed);
    setLogBusy(true); setLogError('');
    const result = await supabase.from('exercise_logs').insert({ user_id: userId, exercise_id: exerciseId, weight: parsed.weight, reps: parsed.reps }).select('id').single();
    setLogBusy(false);
    if (result.error) { setLogError(result.error.message); return; }
    setSelectedKey(null);
    setSaved({ id: (result.data as { id: string }).id, text: formatSet(parsed) });
    await load();
  };

  const undoSaved = async () => {
    if (!saved) return;
    const target = saved;
    setSaved(null);
    const result = await supabase.from('exercise_logs').delete().eq('id', target.id).eq('user_id', userId).select('id');
    if (result.error) setLogError(result.error.message); else await load();
  };

  // El aviso de "guardado" desaparece solo.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 12_000);
    return () => clearTimeout(timer);
  }, [saved]);

  const openEdit = () => { if (!exercise) return; setEditName(exercise.name); setEditCategory(exercise.category); setEditDay(exercise.day_label); setEditError(''); setEditing(true); };
  const saveEdit = async () => {
    if (!editName.trim()) return setEditError('Escribe el nombre del ejercicio.');
    setEditBusy(true); setEditError('');
    const result = await supabase.from('exercises').update({ name: editName.trim(), category: editCategory.trim(), day_label: editDay.trim() }).eq('id', exerciseId).eq('user_id', userId).select('id');
    setEditBusy(false);
    if (result.error) setEditError(result.error.message); else { setEditing(false); await load(); }
  };

  const runDelete = async () => {
    if (!confirm) return;
    setConfirmBusy(true); setConfirmError('');
    const result = confirm.kind === 'exercise'
      ? await supabase.from('exercises').delete().eq('id', exerciseId).eq('user_id', userId).select('id')
      : await supabase.from('exercise_logs').delete().eq('id', confirm.log.id).eq('user_id', userId).select('id');
    setConfirmBusy(false);
    if (result.error) { setConfirmError(result.error.message); return; }
    if (!result.data || result.data.length === 0) { setConfirmError('No se pudo eliminar. Recarga e inténtalo de nuevo.'); return; }
    const wasExercise = confirm.kind === 'exercise';
    setConfirm(null);
    if (wasExercise) onBack(); else await load();
  };

  const change = stats.change;
  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.round} accessibilityLabel="Volver a Ejercicio"><Icon name="arrow-left" size={20} color={colors.ink} /></TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={type.overline}>{exercise ? `${exercise.category.trim() || NO_CATEGORY} · ${exercise.day_label.trim() || NO_DAY}`.toUpperCase() : 'EJERCICIO'}</Text>
        <Text style={styles.title} numberOfLines={2}>{exercise ? exercise.name : 'Ejercicio'}</Text>
      </View>
      {exercise && <>
        <TouchableOpacity onPress={openEdit} hitSlop={8} style={styles.round} accessibilityLabel="Modificar ejercicio"><Icon name="edit-2" size={16} color={colors.inkSoft} /></TouchableOpacity>
        <TouchableOpacity onPress={() => { setConfirmError(''); setConfirm({ kind: 'exercise' }); }} hitSlop={8} style={styles.round} accessibilityLabel="Eliminar ejercicio"><Icon name="trash-2" size={16} color={colors.danger} /></TouchableOpacity>
      </>}
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {loading ? <SkeletonList count={4} rowHeight={92} /> : !exercise
        ? <EmptyState icon="alert-circle" text="No se encontró este ejercicio. Puede que ya se haya eliminado." />
        : <>
          <View style={styles.metrics}>
            <MetricCard value={stats.count > 0 ? formatNumber(stats.bestWeight) : '—'} label="Mejor peso (kg)" accent={stats.count > 0} />
            <MetricCard value={String(stats.sessions)} label={stats.sessions === 1 ? 'Día entrenado' : 'Días entrenados'} />
            <MetricCard value={String(stats.count)} label={stats.count === 1 ? 'Registro' : 'Registros'} />
          </View>
          {stats.sessions > 1 && <Text style={[styles.change, { color: change > 0 ? colors.accent : change < 0 ? colors.danger : colors.muted }]}>
            {change > 0 ? `+${formatNumber(change)} kg` : change < 0 ? `${formatNumber(change)} kg` : 'Sin cambio'} en tu mejor peso desde el primer día registrado
          </Text>}

          <SectionHeader title="Nuevo registro" />
          <Card>
            <LogForm weight={weight} reps={reps} onWeight={setWeight} onReps={setReps} hint={last ? `Última serie: ${formatSet(last)} · ${relativeDay(last.logged_at, today)}` : 'Registra tu primera serie para empezar el historial.'} bestWeight={stats.bestWeight} busy={logBusy} error={logError} onSubmit={saveLog} />
            {saved && <View style={styles.saved}>
              <Icon name="check-circle" size={16} color={colors.accent} />
              <Text style={styles.savedText} numberOfLines={2}>Guardado: <Text style={{ fontWeight: '700' }}>{saved.text}</Text></Text>
              <TouchableOpacity onPress={undoSaved} hitSlop={8} accessibilityLabel="Deshacer el último registro"><Text style={styles.undo}>Deshacer</Text></TouchableOpacity>
            </View>}
          </Card>

          <SectionHeader title="Evolución" meta="Mejor serie de cada día" />
          <Card>
            <ChipRow>{METRICS.map(item => <Chip key={item} label={METRIC_LABELS[item]} selected={metric === item} onPress={() => { setMetric(item); setSelectedKey(null); }} />)}</ChipRow>
            {series.length === 0
              ? <View style={{ marginTop: space.lg }}><EmptyState icon="trending-up" text="La gráfica aparecerá cuando registres tu primera serie." /></View>
              : <>
                <View style={styles.picked}>{picked ? <Text style={styles.pickedText}>{picked.key}: <Text style={{ color: colors.accent }}>{formatNumber(picked.total)} {UNITS[metric]}</Text></Text> : <Text style={type.caption}>{series.length === 1 ? 'Un día registrado. Con más días verás la tendencia.' : 'Toca la gráfica para ver el valor de un día'}</Text>}</View>
                <LineChart points={series.slice(-30)} color={colors.accent} gradientId={`grad-ex-${metric}`} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </>}
          </Card>

          <TouchableOpacity activeOpacity={0.7} onPress={() => setHistoryOpen(value => !value)} style={styles.historyHeader} accessibilityRole="button" accessibilityState={{ expanded: historyOpen }} accessibilityLabel={`Historial, ${logs.length} ${logs.length === 1 ? 'registro' : 'registros'}, ${historyOpen ? 'contraer' : 'expandir'}`}>
            <Text style={styles.historyTitle}>HISTORIAL</Text>
            <Text style={type.caption}>{logs.length} {logs.length === 1 ? 'registro' : 'registros'}</Text>
            <Chevron open={historyOpen} size={18} color={colors.muted} />
          </TouchableOpacity>
          <Collapsible open={historyOpen}>
          {logs.length === 0 ? <EmptyState icon="clock" text="Todavía no hay registros." /> : <Card style={styles.list}>{logs.map((log, index) => <View key={log.id} style={[styles.row, index > 0 && styles.divider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.set}>{formatWeight(log.weight)} × {log.reps}</Text>
              <Text style={type.caption}>{formatDateTime(log.logged_at)} · volumen {formatNumber(volumeOf(log))}</Text>
            </View>
            <TouchableOpacity onPress={() => { setConfirmError(''); setConfirm({ kind: 'log', log }); }} hitSlop={8} style={styles.trash} accessibilityLabel={`Eliminar registro del ${formatDateTime(log.logged_at)}`}><Icon name="trash-2" size={15} color={colors.muted} /></TouchableOpacity>
          </View>)}</Card>}
          </Collapsible>
        </>}
      <ErrorText>{error}</ErrorText>
    </ScrollView>

    <FormSheet visible={editing} title="Modificar ejercicio" onClose={() => setEditing(false)}>
      <ExerciseForm name={editName} category={editCategory} dayLabel={editDay} onName={setEditName} onCategory={setEditCategory} onDayLabel={setEditDay} categorySuggestions={categories} daySuggestions={dayLabels} submitLabel="Guardar cambios" busy={editBusy} error={editError} onSubmit={saveEdit} />
    </FormSheet>

    <ConfirmSheet
      visible={confirm !== null}
      title={confirm?.kind === 'log' ? 'Eliminar registro' : 'Eliminar ejercicio'}
      message={confirm?.kind === 'log' ? `Serie de ${formatSet(confirm.log)} del ${formatDateTime(confirm.log.logged_at)}.` : `¿Eliminar "${exercise?.name ?? ''}"? Se borrará con todo su historial de ${logs.length} ${logs.length === 1 ? 'registro' : 'registros'}.`}
      detail="Esta acción no se puede deshacer."
      confirmLabel={confirm?.kind === 'log' ? 'Eliminar registro' : 'Eliminar ejercicio'}
      busy={confirmBusy}
      error={confirmError}
      onConfirm={runDelete}
      onCancel={() => { setConfirm(null); setConfirmError(''); }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 20, paddingTop: 16, paddingBottom: space.md },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  title: { ...type.title, fontSize: 22, marginTop: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  metrics: { flexDirection: 'row', gap: space.sm },
  change: { fontSize: 12, fontWeight: '500', marginTop: space.md },
  chips: { flexDirection: 'row' },
  picked: { height: 22, marginTop: space.lg, marginBottom: space.sm, justifyContent: 'center' },
  pickedText: { color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, marginTop: space.xl },
  historyTitle: { ...type.overline, color: colors.inkSoft, flex: 1 },
  list: { paddingVertical: 4, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  set: { color: colors.ink, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'], marginBottom: 3 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: 12, backgroundColor: colors.accentGlow },
  savedText: { flex: 1, color: colors.accent, fontSize: 13 },
  undo: { color: colors.ink, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  trash: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
