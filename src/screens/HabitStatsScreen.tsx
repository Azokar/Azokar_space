import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { habitStats, loadHabitHistory, type HabitDay } from '../lib/habitPoints';
import { useToday } from '../lib/useToday';
import LineChart from '../components/LineChart';
import MoonProgress from '../components/MoonProgress';
import { Card, EmptyState, ErrorText, Icon, Metric, ProgressBar, SectionHeader, SkeletonList } from '../components/ui';
import { colors, radius, space, type } from '../theme';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKS = 15;
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Vista de estadísticas de hábitos: días exitosos acumulados, rachas, historial en calendario y evolución de puntos. */
export default function HabitStatsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const today = useToday();
  const [history, setHistory] = useState<HabitDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadHabitHistory(userId, today)
      .then(rows => { if (active) { setHistory(rows); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, today]);

  const stats = useMemo(() => habitStats(history), [history]);
  const byDay = useMemo(() => new Map(history.map(item => [item.day, item])), [history]);

  // Calendario: 15 semanas terminando en la semana actual (columnas de lunes a domingo).
  const weeks = useMemo(() => {
    const now = new Date(`${today}T12:00:00`);
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => { const date = new Date(monday); date.setDate(monday.getDate() + (w - (WEEKS - 1)) * 7 + d); return toKey(date); }));
  }, [today]);

  const months = useMemo(() => {
    const groups = new Map<string, { ok: number; total: number }>();
    history.forEach(item => { const key = item.day.slice(0, 7); const g = groups.get(key) ?? { ok: 0, total: 0 }; g.total += 1; if (item.successful) g.ok += 1; groups.set(key, g); });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [history]);

  const chartPoints = useMemo(() => stats.series.slice(-30).map(item => ({ key: item.day, label: String(Number(item.day.slice(8))), total: item.points })), [stats.series]);
  const picked = chartPoints.find(point => point.key === selectedKey);

  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Volver a Hábitos"><Icon name="arrow-left" size={20} color={colors.ink} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={type.overline}>HÁBITOS</Text><Text style={styles.title}>Días exitosos</Text></View>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <SkeletonList count={3} rowHeight={110} /> : <>
        <ErrorText>{error}</ErrorText>
        <Card glow style={styles.hero}>
          <Text style={type.overline}>DÍAS EXITOSOS ACUMULADOS</Text>
          <Text style={styles.heroValue}>{stats.successful}</Text>
          <Text style={type.caption}>{stats.tracked === 0 ? 'Aún no hay días cerrados. El primero se cuenta al terminar hoy.' : `de ${stats.tracked} ${stats.tracked === 1 ? 'día registrado' : 'días registrados'} · ${stats.rate}% de éxito`}</Text>
          {stats.tracked > 0 && <View style={{ marginTop: space.md }}><ProgressBar percent={stats.rate} /></View>}
        </Card>

        <View style={styles.metrics}>
          <Metric value={String(stats.currentStreak)} label={stats.currentStreak === 1 ? 'Día de racha' : 'Días de racha'} accent={stats.currentStreak > 0} />
          <Metric value={String(stats.bestStreak)} label="Mejor racha" />
          <Metric value={String(stats.failed)} label="Días fallidos" />
        </View>

        <View style={{ marginTop: space.lg }}><MoonProgress points={stats.points} /></View>

        <SectionHeader title="Historial" meta={`Últimas ${WEEKS} semanas`} />
        {stats.tracked === 0 ? <EmptyState icon="calendar" text="Tu historial aparecerá aquí cuando se cierre el primer día." /> : <Card>
          <View style={styles.heat}>
            <View style={styles.weekdays}>{['L', '', 'X', '', 'V', '', 'D'].map((label, i) => <Text key={i} style={styles.weekdayLabel}>{label}</Text>)}</View>
            {weeks.map((week, w) => <View key={w} style={styles.weekCol}>{week.map(day => {
              const item = byDay.get(day);
              const future = day > today;
              return <View key={day} accessibilityLabel={`${day}: ${item ? (item.successful ? 'día exitoso' : 'día no exitoso') : 'sin datos'}`} style={[styles.cell, item?.successful && styles.cellOk, item && !item.successful && styles.cellFail, future && styles.cellFuture, day === today && styles.cellToday]} />;
            })}</View>)}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellOk]} /><Text style={type.caption}>Exitoso</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellFail]} /><Text style={type.caption}>No exitoso</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellEmpty]} /><Text style={type.caption}>Sin datos</Text></View>
          </View>
        </Card>}

        {months.length > 0 && <>
          <SectionHeader title="Por mes" />
          <Card>{months.map(([key, group], index) => <View key={key} style={[styles.monthRow, index > 0 && styles.monthDivider]}>
            <View style={styles.monthTop}><Text style={styles.monthName}>{MONTHS[Number(key.slice(5, 7)) - 1]} {key.slice(0, 4)}</Text><Text style={type.caption}>{group.ok} de {group.total} {group.total === 1 ? 'día' : 'días'}</Text></View>
            <ProgressBar percent={(group.ok / group.total) * 100} />
          </View>)}</Card>
        </>}

        {chartPoints.length > 1 && <>
          <SectionHeader title="Evolución de puntos" meta="Últimos 30 días cerrados" />
          <Card>
            <View style={styles.picked}>{picked ? <Text style={styles.pickedText}>{picked.key}: <Text style={{ color: colors.accent }}>{picked.total} puntos</Text></Text> : <Text style={type.caption}>Toca la gráfica para ver el valor de un día</Text>}</View>
            <LineChart points={chartPoints} color={colors.accent} gradientId="grad-habit-points" selectedKey={selectedKey} onSelect={setSelectedKey} />
          </Card>
        </>}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 20, paddingTop: 16, paddingBottom: space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  title: { ...type.title, marginTop: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { paddingVertical: space.xl },
  heroValue: { color: colors.accent, fontSize: 56, fontWeight: '200', letterSpacing: -2, marginVertical: space.sm },
  metrics: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  heat: { flexDirection: 'row', gap: 3 },
  weekdays: { width: 14, justifyContent: 'space-between', paddingVertical: 1 },
  weekdayLabel: { ...type.caption, fontSize: 11, height: 14, lineHeight: 14 },
  weekCol: { flex: 1, gap: 3 },
  cell: { width: '100%', aspectRatio: 1, borderRadius: 4, backgroundColor: 'rgba(160, 190, 230, 0.07)' },
  cellOk: { backgroundColor: colors.accent },
  cellFail: { backgroundColor: 'rgba(255, 138, 155, 0.45)' },
  cellFuture: { opacity: 0.35 },
  cellToday: { borderWidth: 1, borderColor: colors.ink },
  cellEmpty: { backgroundColor: 'rgba(160, 190, 230, 0.07)' },
  legend: { flexDirection: 'row', gap: space.lg, marginTop: space.md, justifyContent: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  monthRow: { paddingVertical: space.md },
  monthDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  monthTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  monthName: { color: colors.ink, fontSize: 13 },
  picked: { height: 22, justifyContent: 'center', marginBottom: space.sm },
  pickedText: { color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
});
