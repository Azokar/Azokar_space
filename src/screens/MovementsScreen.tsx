import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { deleteTransactionWithRollback } from '../lib/transactions';
import ConfirmSheet from '../components/ConfirmSheet';
import { Button, Card, Chip, EmptyState, ErrorText, Icon, ChipRow, SkeletonList, Reveal } from '../components/ui';
import { colors, money, space, type } from '../theme';

type Movement = { id: string; kind: 'income' | 'expense'; amount: number; note: string; occurred_on: string; category_id: string | null; distributes_fixed: boolean };
type Filter = 'all' | 'income' | 'expense';
const PAGE = 50;
const FILTERS: { value: Filter; label: string }[] = [{ value: 'all', label: 'Todos' }, { value: 'income', label: 'Ingresos' }, { value: 'expense', label: 'Gastos' }];

/** Historial completo de ingresos y gastos, con filtro por tipo y eliminación con reversión de cálculos. */
export default function MovementsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Movement | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    let query = supabase.from('transactions').select('id, kind, amount, note, occurred_on, category_id, distributes_fixed').eq('user_id', userId).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
    if (filter !== 'all') query = query.eq('kind', filter);
    const [tx, cats] = await Promise.all([query, supabase.from('categories').select('id, name').eq('user_id', userId)]);
    const failure = tx.error ?? cats.error;
    if (failure) setError(failure.message);
    else { setError(''); setRows((tx.data ?? []) as Movement[]); setCategories(new Map((cats.data ?? []).map(item => [item.id as string, item.name as string]))); }
    setLoading(false);
  }, [userId, filter, limit]);
  useEffect(() => { void load(); }, [load]);

  const categoryOf = (row: Movement) => (row.category_id ? categories.get(row.category_id) : undefined) ?? 'Sin categoría';
  const hasMore = rows.length >= limit;

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true); setDeleteError('');
    try { await deleteTransactionWithRollback(userId, pending); setPending(null); await load(); }
    catch (reason) { setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el movimiento.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Volver a Finanzas"><Icon name="arrow-left" size={20} color={colors.ink} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={type.overline}>FINANZAS</Text><Text style={styles.title}>Movimientos</Text></View>
    </View>
    <ChipRow style={styles.filters}>{FILTERS.map(item => <Chip key={item.value} label={item.label} selected={filter === item.value} onPress={() => { setFilter(item.value); setLimit(PAGE); setLoading(true); }} />)}</ChipRow>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <SkeletonList count={6} rowHeight={60} /> : rows.length === 0
        ? <EmptyState icon="credit-card" text={filter === 'all' ? 'Todavía no hay ingresos ni gastos registrados.' : filter === 'income' ? 'Todavía no hay ingresos registrados.' : 'Todavía no hay gastos registrados.'} />
        : <>
          <Card style={styles.list}>{rows.map((row, index) => {
            const isIncome = row.kind === 'income';
            const category = categoryOf(row);
            return <Reveal key={row.id} index={index}><View style={[styles.row, index > 0 && styles.divider]}>
              <View style={[styles.icon, isIncome && styles.iconIncome]}><Icon name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={isIncome ? colors.accent : colors.danger} /></View>
              <View style={styles.copy}><Text style={styles.rowTitle} numberOfLines={1}>{row.note || category}</Text><Text style={type.caption}>{category} · {row.occurred_on}</Text></View>
              <Text style={[styles.amount, isIncome && { color: colors.accent }]}>{isIncome ? '+' : '−'}{money(Number(row.amount))}</Text>
              <TouchableOpacity onPress={() => { setDeleteError(''); setPending(row); }} hitSlop={8} style={styles.delete} accessibilityLabel={`Eliminar movimiento ${row.note || category}`}><Icon name="trash-2" size={15} color={colors.muted} /></TouchableOpacity>
            </View></Reveal>;
          })}</Card>
          {hasMore && <Button label="Cargar más" variant="ghost" onPress={() => setLimit(value => value + PAGE)} />}
        </>}
      <ErrorText>{error}</ErrorText>
    </ScrollView>

    <ConfirmSheet
      visible={pending !== null}
      title="Eliminar movimiento"
      message={pending ? `${pending.kind === 'income' ? 'Ingreso' : 'Gasto'} de ${money(Number(pending.amount))} (${pending.note || categoryOf(pending)}, ${pending.occurred_on}).` : ''}
      detail={pending ? `Se restará del balance${pending.kind === 'income' && pending.distributes_fixed ? ' y se revertirá el reparto a tus gastos fijos: sus barras de progreso volverán al nivel anterior' : ''}. Esta acción no se puede deshacer.` : undefined}
      confirmLabel="Eliminar movimiento"
      busy={busy}
      error={deleteError}
      onConfirm={confirmDelete}
      onCancel={() => { setPending(null); setDeleteError(''); }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 20, paddingTop: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  title: { ...type.title, marginTop: 4 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: space.lg, paddingBottom: space.md },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  list: { paddingVertical: 4, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  iconIncome: { backgroundColor: colors.accentGlow },
  copy: { flex: 1, marginLeft: space.md, gap: 3 },
  rowTitle: { color: colors.ink, fontSize: 14 },
  amount: { color: colors.inkSoft, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  delete: { marginLeft: space.sm, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
