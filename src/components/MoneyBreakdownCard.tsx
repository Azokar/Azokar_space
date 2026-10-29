import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AnimatedNumber from './AnimatedNumber';
import { Card, Icon, type IconName } from './ui';
import { fetchMoneyOverview, type MoneyOverview } from '../lib/money';
import { useToday } from '../lib/useToday';
import { colors, money, radius, space, type } from '../theme';

const TONE_EXPENSES = '#E8B86B';
const TONE_GOALS = '#8EC5FF';

type Props = {
  userId: string;
  /** Cambia cuando se guarda o borra algo en la pantalla, para volver a calcular. */
  refreshKey?: number;
};

/** "Tu dinero": cuánto hay en la cuenta y cómo se reparte entre gastos, metas y dinero libre. */
export default function MoneyBreakdownCard({ userId, refreshKey = 0 }: Props) {
  const today = useToday();
  const [overview, setOverview] = useState<MoneyOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchMoneyOverview(userId, today)
      .then(result => { if (active) { setOverview(result); setError(''); } })
      .catch(reason => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'No se pudo calcular tu dinero.';
        setError(/finance_totals|schema cache|does not exist|function/i.test(message) ? 'Falta una función en Supabase. Ejecuta supabase/migrations/20261031_finance_totals.sql.' : message);
      });
    return () => { active = false; };
  }, [userId, today, refreshKey]);

  if (!overview) {
    return <Card glow style={styles.card}>
      <Text style={type.overline}>TOTAL EN CUENTA</Text>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.accent} style={{ marginVertical: space.xl }} />}
    </Card>;
  }

  const negativeFree = overview.free < 0;
  // Reparto del dinero de la cuenta en una barra; si lo asignado supera lo que hay, se escala para que quepa.
  const positive = (value: number) => Math.max(0, value);
  const parts = { expenses: positive(overview.setAsideExpenses), goals: positive(overview.setAsideGoals), free: positive(overview.free) };
  const total = parts.expenses + parts.goals + parts.free;
  const share = (value: number) => (total > 0 ? `${(value / total) * 100}%` as const : '0%' as const);

  return <Card glow style={styles.card}>
    <Text style={type.overline}>TOTAL EN CUENTA</Text>
    <Text style={[styles.total, overview.account < 0 && { color: colors.danger }]}><AnimatedNumber value={overview.account} format={money} /></Text>

    {overview.account > 0 && total > 0 && <View style={styles.bar}>
      <View style={{ width: share(parts.expenses), backgroundColor: TONE_EXPENSES }} />
      <View style={{ width: share(parts.goals), backgroundColor: TONE_GOALS }} />
      <View style={{ width: share(parts.free), backgroundColor: colors.accent }} />
    </View>}

    <Row icon="shopping-bag" tone={TONE_EXPENSES} label="Apartado para gastos" value={overview.setAsideExpenses}
      detail={overview.limitDefined ? `Fijos ${money(overview.fixedReserved)} · Presupuesto de la quincena ${money(overview.operativeBudget)}` : `Fijos ${money(overview.fixedReserved)} · Sin límite de gastos definido`} />
    <Row icon="target" tone={TONE_GOALS} label="Apartado para metas" value={overview.setAsideGoals} detail="Lo aportado a tus metas financieras" />
    <Row icon="unlock" tone={negativeFree ? colors.danger : colors.accent} label="Libre" value={overview.free} strong negative={negativeFree}
      detail={negativeFree ? 'Asignaste más de lo que tienes en cuenta' : 'No está asignado a gastos, límite ni metas'} />

    <View style={styles.footer}>
      <View style={styles.flow}><Icon name="arrow-down-left" size={14} color={colors.accent} /><Text style={styles.flowText}>{money(overview.monthIncome)}</Text></View>
      <View style={styles.flow}><Icon name="arrow-up-right" size={14} color={colors.danger} /><Text style={styles.flowText}>{money(overview.monthExpenses)}</Text></View>
      <Text style={styles.footerLabel}>este mes</Text>
    </View>
  </Card>;
}

function Row({ icon, tone, label, value, detail, strong, negative }: { icon: IconName; tone: string; label: string; value: number; detail: string; strong?: boolean; negative?: boolean }) {
  return <View style={styles.row}>
    <View style={[styles.dot, { backgroundColor: `${tone}22` }]}><Icon name={icon} size={15} color={tone} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowDetail}>{detail}</Text>
    </View>
    <AnimatedNumber value={value} format={money} style={[styles.rowValue, strong && { color: tone, fontSize: 18 }, negative && { color: colors.danger }]} />
  </View>;
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.xl },
  total: { color: colors.ink, fontSize: 40, fontWeight: '200', letterSpacing: -1.5, marginTop: space.sm },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.lg, backgroundColor: 'rgba(160, 190, 230, 0.1)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  rowDetail: { ...type.caption, fontSize: 12, marginTop: 2, lineHeight: 15 },
  rowValue: { color: colors.inkSoft, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xl, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowText: { color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
  footerLabel: { ...type.caption, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, marginTop: space.md, lineHeight: 18 },
});
