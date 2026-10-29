import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { toDateString } from '../lib/fixedExpenses';
import { RANGE_LABELS, RANGE_TITLES, bucketTitle, buildReport, rangeStart, type ReportRange, type ReportRow } from '../lib/reports';
import AnimatedNumber from '../components/AnimatedNumber';
import LineChart from '../components/LineChart';
import { Card, Chip, EmptyState, ErrorText, Icon, ChipRow, SkeletonList } from '../components/ui';
import { colors, money, radius, space, type } from '../theme';

const RANGES: ReportRange[] = ['week', 'quincena', 'month', 'sixMonths', 'year'];

/** Vista independiente de estadísticas: tendencia de ingresos y de gastos con filtros de periodo y de categoría. */
export default function StatsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [range, setRange] = useState<ReportRange>('month');
  const [income, setIncome] = useState<ReportRow[]>([]);
  const [expenses, setExpenses] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = toDateString(new Date());

  useEffect(() => {
    let active = true;
    const start = rangeStart('year', today);
    (async () => {
      const [tx, cats, paid] = await Promise.all([
        supabase.from('transactions').select('kind, amount, occurred_on, category_id').eq('user_id', userId).gte('occurred_on', start).lte('occurred_on', today).limit(5000),
        supabase.from('categories').select('id, name').eq('user_id', userId),
        supabase.from('fixed_expense_periods').select('amount, paid_at').eq('user_id', userId).not('paid_at', 'is', null),
      ]);
      if (!active) return;
      const failure = tx.error ?? cats.error;
      if (failure) { setError(failure.message); setLoading(false); return; }
      const names = new Map((cats.data ?? []).map(item => [item.id as string, item.name as string]));
      const incomeRows: ReportRow[] = [];
      const expenseRows: ReportRow[] = [];
      (tx.data ?? []).forEach(row => {
        const mapped = { amount: Number(row.amount), date: row.occurred_on as string, category: names.get(row.category_id as string) ?? 'Sin categoría' };
        (row.kind === 'income' ? incomeRows : expenseRows).push(mapped);
      });
      // Un gasto fijo pagado cuenta como gasto en la fecha en que se marcó como pagado.
      if (!paid.error) (paid.data ?? []).forEach(row => { const date = toDateString(new Date(row.paid_at as string)); if (date >= start && date <= today) expenseRows.push({ amount: Number(row.amount), date, category: 'Gastos fijos' }); });
      setIncome(incomeRows); setExpenses(expenseRows); setError(''); setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, today]);

  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Volver a Finanzas"><Icon name="arrow-left" size={20} color={colors.ink} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={type.overline}>FINANZAS</Text><Text style={styles.title}>Estadísticas</Text></View>
    </View>
    <ChipRow style={styles.rangeBar}>{RANGES.map(item => <Chip key={item} label={RANGE_LABELS[item]} selected={range === item} onPress={() => setRange(item)} />)}</ChipRow>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <SkeletonList count={2} rowHeight={300} gap={16} /> : <>
        <TrendCard kind="income" rows={income} range={range} today={today} />
        <TrendCard kind="expense" rows={expenses} range={range} today={today} />
      </>}
      <ErrorText>{error}</ErrorText>
    </ScrollView>
  </View>;
}

function TrendCard({ kind, rows, range, today }: { kind: 'income' | 'expense'; rows: ReportRow[]; range: ReportRange; today: string }) {
  const isIncome = kind === 'income';
  const tone = isIncome ? colors.accent : colors.danger;
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Categorías con movimientos dentro del periodo elegido, de mayor a menor monto.
  const available = useMemo(() => buildReport(rows, range, today).categories.map(item => item.name), [rows, range, today]);
  const active = selectedCategories.filter(name => available.includes(name));
  const filtered = useMemo(() => (active.length === 0 ? rows : rows.filter(row => active.includes(row.category))), [rows, active.join('|')]);
  const report = useMemo(() => buildReport(filtered, range, today), [filtered, range, today]);
  const picked = report.buckets.find(bucket => bucket.key === selectedKey);

  const toggle = (name: string) => { setSelectedKey(null); setSelectedCategories(current => (current.includes(name) ? current.filter(item => item !== name) : [...current, name])); };

  return <Card style={{ marginBottom: space.lg }}>
    <View style={styles.cardTop}>
      <Text style={type.overline}>{isIncome ? 'INGRESOS' : 'GASTOS'}</Text>
      <Text style={styles.rangeTitle}>{RANGE_TITLES[range]}</Text>
    </View>

    <Text style={[styles.total, { color: tone }]}>{isIncome ? '' : '− '}<AnimatedNumber value={report.total} format={money} /></Text>
    <Text style={type.caption}><AnimatedNumber value={report.average} format={money} /> {report.averageLabel} · <AnimatedNumber value={report.count} /> {report.count === 1 ? 'registro' : 'registros'}{active.length > 0 ? ` · ${active.length} ${active.length === 1 ? 'categoría' : 'categorías'}` : ''}</Text>

    {available.length > 0 && <>
      <Text style={[type.overline, { marginTop: space.lg, marginBottom: space.sm }]}>CATEGORÍA</Text>
      <ChipRow scroll>
        <Chip label="Todas" selected={active.length === 0} onPress={() => { setSelectedKey(null); setSelectedCategories([]); }} />
        {available.map(name => <Chip key={name} label={name} selected={active.includes(name)} onPress={() => toggle(name)} />)}
      </ChipRow>
    </>}

    {report.count === 0
      ? <View style={{ marginTop: space.lg }}><EmptyState icon="trending-up" text={isIncome ? 'Sin ingresos en este periodo.' : 'Sin gastos en este periodo.'} /></View>
      : <>
        <View style={styles.picked}>{picked
          ? <Text style={styles.pickedText}>{bucketTitle(picked.key)}: <Text style={{ color: tone }}>{money(picked.total)}</Text></Text>
          : <Text style={type.caption}>Toca la gráfica para ver el valor de un punto</Text>}</View>
        <LineChart points={report.buckets} color={tone} gradientId={`grad-${kind}`} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </>}
  </Card>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 20, paddingTop: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  title: { ...type.title, marginTop: 4 },
  rangeBar: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: space.lg, paddingBottom: space.md },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeTitle: { ...type.caption, fontSize: 12 },
  total: { fontSize: 34, fontWeight: '200', letterSpacing: -1, marginTop: space.md, fontVariant: ['tabular-nums'] },
  picked: { height: 22, marginTop: space.lg, marginBottom: space.sm, justifyContent: 'center' },
  pickedText: { color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
});
