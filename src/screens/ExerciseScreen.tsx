import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useToday } from '../lib/useToday';
import { useAutoScroll, useScrollLock } from '../lib/scrollLock';
import { NO_CATEGORY, NO_DAY, formatNumber, formatSet, groupByDay, lastLogByExercise, relativeDay, weekdayName, type Exercise, type ExerciseLog } from '../lib/workouts';
import DayGroup, { type ViewNode } from '../components/DayGroup';
import DraggableCard from '../components/DraggableCard';
import DayTagForm from '../components/DayTagForm';
import ExerciseForm from '../components/ExerciseForm';
import FormSheet from '../components/FormSheet';
import LogForm, { parseLog } from '../components/LogForm';
import { Button, Card, EmptyState, ErrorText, Icon, SkeletonList } from '../components/ui';
import { colors, radius, space, type } from '../theme';

const MISSING = 'Faltan las tablas de ejercicios. Ejecuta supabase/migrations/20261029_exercises.sql en el SQL Editor de Supabase.';
type Rect = { x: number; y: number; w: number; h: number };

export default function ExerciseScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const today = useToday();
  const lockScroll = useScrollLock();
  const autoScroll = useAutoScroll();
  const { height: windowHeight } = useWindowDimensions();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'create' | 'log' | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [dayLabel, setDayLabel] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  // Etiquetas por día o rutina (por ejemplo, Lunes -> Pecho).
  const [tags, setTags] = useState<Record<string, string>>({});
  const [tagDay, setTagDay] = useState<string | null>(null);
  const [tagValue, setTagValue] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState('');

  // Días plegables y arrastre: `open` guarda lo que el usuario abrió o cerró; sin elección, solo se abre el día de hoy.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ id: string; from: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, ViewNode | null>>({});
  const rects = useRef<Record<string, Rect>>({});
  const hoverRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [exerciseRows, logRows, tagRows] = await Promise.all([
      supabase.from('exercises').select('id, name, category, day_label, created_at').eq('user_id', userId).order('created_at'),
      supabase.from('exercise_logs').select('id, exercise_id, weight, reps, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(1000),
      supabase.from('exercise_day_tags').select('day_label, tag').eq('user_id', userId),
    ]);
    const failure = exerciseRows.error ?? logRows.error;
    if (failure) setError(/exercise|schema cache|does not exist|relation/i.test(failure.message) ? MISSING : failure.message);
    else {
      setExercises((exerciseRows.data ?? []) as Exercise[]); setLogs((logRows.data ?? []) as ExerciseLog[]);
      // Las etiquetas son opcionales: si su tabla aún no existe, el resto de la pantalla funciona igual.
      if (!tagRows.error) setTags(Object.fromEntries((tagRows.data ?? []).map(row => [row.day_label as string, row.tag as string])));
      setError(tagRows.error ? 'Falta la tabla de etiquetas. Ejecuta supabase/migrations/20261030_exercise_day_tags.sql en Supabase.' : '');
    }
    setLoading(false);
  }, [userId]);
  // Recarga al montar y al volver desde el detalle de un ejercicio.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const groups = useMemo(() => groupByDay(exercises), [exercises]);
  const lastLogs = useMemo(() => lastLogByExercise(logs), [logs]);
  const categories = useMemo(() => [...new Set(exercises.map(item => item.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [exercises]);
  const dayLabels = useMemo(() => [...new Set(exercises.map(item => item.day_label.trim()).filter(Boolean))], [exercises]);
  const todayName = weekdayName(today);
  const isOpen = (label: string, count: number) => open[label] ?? (label === todayName && count > 0);

  const openCreate = () => { setName(''); setCategory(''); setDayLabel(''); setFormError(''); setModal('create'); };
  const openLog = (exercise: Exercise) => {
    const last = lastLogs.get(exercise.id);
    setSelected(exercise); setWeight(last ? String(last.weight) : ''); setReps(last ? String(last.reps) : ''); setFormError(''); setModal('log');
  };
  const closeModal = () => { setModal(null); setSelected(null); setFormError(''); };

  const saveExercise = async () => {
    if (!name.trim()) return setFormError('Escribe el nombre del ejercicio.');
    setBusy(true); setFormError('');
    const result = await supabase.from('exercises').insert({ user_id: userId, name: name.trim(), category: category.trim(), day_label: dayLabel.trim() }).select('id').single();
    setBusy(false);
    if (result.error) setFormError(/exercise|schema cache|does not exist|relation/i.test(result.error.message) ? MISSING : result.error.message);
    else { closeModal(); await load(); }
  };

  const saveLog = async () => {
    if (!selected) return;
    const parsed = parseLog(weight, reps);
    if (typeof parsed === 'string') return setFormError(parsed);
    setBusy(true); setFormError('');
    const result = await supabase.from('exercise_logs').insert({ user_id: userId, exercise_id: selected.id, weight: parsed.weight, reps: parsed.reps }).select('id').single();
    setBusy(false);
    if (result.error) setFormError(result.error.message); else { closeModal(); await load(); }
  };

  // --- Arrastrar un ejercicio a otro día ---
  const targetAt = (x: number, y: number) => Object.entries(rects.current).find(([, r]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.[0] ?? null;

  const startDrag = (exercise: Exercise, from: string) => {
    setDrag({ id: exercise.id, from }); setError(''); lockScroll(true);
    // Posición en pantalla de cada día; la página no se desplaza mientras se arrastra, así que no cambia.
    Object.entries(groupRefs.current).forEach(([label, node]) => node?.measureInWindow((x, y, w, h) => { rects.current[label] = { x, y, w, h }; }));
  };
  const pointer = useRef({ x: 0, y: 0, from: '' });
  const updateHover = () => {
    const target = targetAt(pointer.current.x, pointer.current.y);
    const next = target && target !== pointer.current.from ? target : null;
    if (next !== hoverRef.current) { hoverRef.current = next; setHover(next); }
  };
  const moveDrag = (x: number, y: number, from: string) => { pointer.current = { x, y, from }; updateHover(); };
  const endDrag = () => { setDrag(null); setHover(null); hoverRef.current = null; lockScroll(false); };

  // Desplazamiento automático: si el dedo está cerca del borde superior o inferior, la página avanza (más rápido cuanto más cerca).
  // Como los días se mueven con la página, se vuelven a medir en cada paso para que el destino resaltado sea el correcto.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const topEdge = 150;
    const bottomEdge = 190; // deja libre la barra inferior
    const maxStep = 16;
    const timer = setInterval(() => {
      const y = pointer.current.y;
      let step = 0;
      if (y < topEdge) step = -Math.min(1, (topEdge - y) / topEdge) * maxStep;
      else if (y > windowHeight - bottomEdge) step = Math.min(1, (y - (windowHeight - bottomEdge)) / bottomEdge) * maxStep;
      if (step === 0) return;
      autoScroll.by(step);
      Object.entries(groupRefs.current).forEach(([label, node]) => node?.measureInWindow((rx, ry, w, h) => { rects.current[label] = { x: rx, y: ry, w, h }; }));
      updateHover();
    }, 16);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, windowHeight]);

  const moveExercise = async (exercise: Exercise, label: string) => {
    const newDay = label === NO_DAY ? '' : label;
    const previous = exercises;
    setExercises(list => list.map(item => (item.id === exercise.id ? { ...item, day_label: newDay } : item)));
    setOpen(current => ({ ...current, [label]: true }));
    const result = await supabase.from('exercises').update({ day_label: newDay }).eq('id', exercise.id).eq('user_id', userId).select('id');
    if (result.error || !result.data || result.data.length === 0) {
      setExercises(previous);
      setError(result.error ? result.error.message : 'No se pudo mover el ejercicio. Inténtalo de nuevo.');
    }
  };
  const dropDrag = (x: number, y: number, exercise: Exercise, from: string) => {
    const target = targetAt(x, y);
    endDrag();
    if (target && target !== from) void moveExercise(exercise, target);
  };

  // --- Etiquetas de día ---
  const openTag = (label: string) => { setTagDay(label); setTagValue(tags[label] ?? ''); setTagError(''); };
  const closeTag = () => { setTagDay(null); setTagError(''); };
  const saveTag = async (remove: boolean) => {
    if (!tagDay) return;
    const value = tagValue.trim();
    if (!remove && !value) return setTagError('Escribe una etiqueta o usa "Quitar etiqueta".');
    setTagBusy(true); setTagError('');
    const result = remove || !value
      ? await supabase.from('exercise_day_tags').delete().eq('user_id', userId).eq('day_label', tagDay).select('day_label')
      : await supabase.from('exercise_day_tags').upsert({ user_id: userId, day_label: tagDay, tag: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day_label' }).select('day_label');
    setTagBusy(false);
    if (result.error) { setTagError(/exercise_day_tags|schema cache|does not exist|relation/i.test(result.error.message) ? 'Falta la tabla de etiquetas. Ejecuta supabase/migrations/20261030_exercise_day_tags.sql en Supabase.' : result.error.message); return; }
    setTags(current => { const next = { ...current }; if (remove || !value) delete next[tagDay]; else next[tagDay] = value; return next; });
    closeTag();
  };

  const openDetail = (exercise: Exercise) => router.push({ pathname: '/ejercicio', params: { id: exercise.id } });
  const lastForSelected = selected ? lastLogs.get(selected.id) : undefined;

  return <View>
    <Button label="Nuevo ejercicio" icon="plus" onPress={openCreate} style={{ marginTop: 0 }} />
    {exercises.length > 0 && <Text style={styles.tip}>Toca un día para abrirlo o cerrarlo, y el icono de etiqueta para nombrarlo (Lunes · Pecho). Mantén pulsado un ejercicio y arrástralo a otro día para moverlo.</Text>}
    <ErrorText>{error}</ErrorText>

    {loading ? <SkeletonList count={4} rowHeight={96} /> : exercises.length === 0
      ? <View style={{ marginTop: space.xl }}><EmptyState icon="activity" text="Aún no tienes ejercicios. Crea el primero con nombre, categoría y el día o rutina en que lo haces." /></View>
      : <View style={{ marginTop: space.sm }}>{groups.map(group => <DayGroup
        key={group.label}
        label={group.label}
        count={group.items.length}
        expanded={isOpen(group.label, group.items.length)}
        onToggle={() => setOpen(current => ({ ...current, [group.label]: !isOpen(group.label, group.items.length) }))}
        isToday={group.label === todayName}
        tag={tags[group.label]}
        onEditTag={group.label === NO_DAY ? undefined : () => openTag(group.label)}
        hovered={hover === group.label}
        raised={drag?.from === group.label}
        dragging={drag !== null}
        setRef={node => { groupRefs.current[group.label] = node; }}
      >
        {group.items.map(exercise => {
          const last = lastLogs.get(exercise.id);
          return <DraggableCard key={exercise.id} scrollOffset={autoScroll.offset} onDragStart={() => startDrag(exercise, group.label)} onDragMove={(x, y) => moveDrag(x, y, group.label)} onDrop={(x, y) => dropDrag(x, y, exercise, group.label)} onDragEnd={endDrag}>
            <Card style={styles.card}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => openDetail(exercise)} style={styles.top} accessibilityLabel={`Ver historial de ${exercise.name}`}>
                <Icon name="menu" size={16} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>
                  <View style={styles.pill}><Text style={styles.pillText}>{exercise.category.trim() || NO_CATEGORY}</Text></View>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </TouchableOpacity>
              <Text style={styles.last}>{last ? <>Último: <Text style={styles.lastValue}>{formatSet(last)}</Text> · {relativeDay(last.logged_at, today)}</> : 'Sin registros todavía'}</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => openLog(exercise)} style={styles.logButton} accessibilityLabel={`Registrar serie de ${exercise.name}`}>
                <Icon name="plus" size={14} color={colors.onAccent} /><Text style={styles.logButtonText}>Registrar</Text>
              </TouchableOpacity>
            </Card>
          </DraggableCard>;
        })}
      </DayGroup>)}</View>}

    <FormSheet visible={modal === 'create'} title="Nuevo ejercicio" onClose={closeModal}>
      <ExerciseForm name={name} category={category} dayLabel={dayLabel} onName={setName} onCategory={setCategory} onDayLabel={setDayLabel} categorySuggestions={categories} daySuggestions={dayLabels} submitLabel="Guardar ejercicio" busy={busy} error={formError} onSubmit={saveExercise} />
    </FormSheet>

    <FormSheet visible={tagDay !== null} title={tagDay ? `Etiqueta de ${tagDay}` : 'Etiqueta'} onClose={closeTag}>
      <DayTagForm day={tagDay ?? ''} value={tagValue} onChange={setTagValue} suggestions={categories} hasTag={!!(tagDay && tags[tagDay])} busy={tagBusy} error={tagError} onSave={() => saveTag(false)} onRemove={() => saveTag(true)} />
    </FormSheet>

    <FormSheet visible={modal === 'log'} title={selected ? selected.name : 'Registrar'} onClose={closeModal}>
      <LogForm weight={weight} reps={reps} onWeight={setWeight} onReps={setReps} hint={lastForSelected ? `Última serie: ${formatSet(lastForSelected)} · ${relativeDay(lastForSelected.logged_at, today)}` : 'Primer registro de este ejercicio.'} bestWeight={selected ? Math.max(0, ...logs.filter(item => item.exercise_id === selected.id).map(item => Number(item.weight))) : 0} busy={busy} error={formError} onSubmit={saveLog} />
      {lastForSelected && <Text style={[type.caption, { marginTop: space.sm }]}>Los campos traen tu última serie; cámbialos si hoy cargaste distinto ({formatNumber(Number(lastForSelected.weight))} kg).</Text>}
    </FormSheet>
  </View>;
}

const styles = StyleSheet.create({
  tip: { ...type.caption, marginTop: space.md, lineHeight: 18 },
  card: { marginTop: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...type.heading, fontSize: 16 },
  pill: { alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  pillText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  last: { ...type.caption, marginTop: space.md },
  lastValue: { color: colors.ink, fontWeight: '600' },
  logButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.accent },
  logButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
