import React from 'react';
import { LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, ProgressBar } from './ui';
import type { fixedOverview } from '../lib/fixedExpenses';
import { colors, money, radius, space, type } from '../theme';

type Props = {
  overview: ReturnType<typeof fixedOverview>;
  count: number;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  onAdd: () => void;
  children: React.ReactNode;
};

/** Sección plegable: cerrada muestra el resumen clave; abierta, la lista completa de gastos fijos. */
export default function FixedExpensesAccordion({ overview, count, expanded, onToggle, onAdd, children }: Props) {
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); onToggle(!expanded); };
  const hasExpenses = count > 0;
  return <View style={[styles.wrap, overview.overdueCount > 0 && styles.wrapOverdue]}>
    <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`Gastos fijos, ${expanded ? 'contraer' : 'expandir'}`}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>GASTOS FIJOS</Text>
        <View style={styles.headerRight}>
          {overview.overdueCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{overview.overdueCount} {overview.overdueCount === 1 ? 'vencido' : 'vencidos'}</Text></View>}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </View>
      </View>

      {hasExpenses && !expanded && <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={styles.percent}>{overview.reservedPercent}%</Text>
          <Text style={styles.percentLabel}>cubierto de {money(overview.total)} al mes</Text>
        </View>
        <ProgressBar percent={overview.reservedPercent} tone={overview.overdueCount > 0 ? 'danger' : 'accent'} />
        <View style={styles.moneyRow}>
          <View><Text style={styles.moneyValue}>{money(overview.reserved)}</Text><Text style={styles.moneyLabel}>Reservado del salario</Text></View>
          <View style={styles.moneyMiddle}><Text style={styles.moneyValue}>{money(overview.paid)}</Text><Text style={styles.moneyLabel}>Ya pagado</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={[styles.moneyValue, overview.missing > 0 && { color: colors.inkSoft }]}>{money(overview.missing)}</Text><Text style={styles.moneyLabel}>{overview.missing > 0 ? 'Falta para cubrirlos' : 'Cubiertos por completo'}</Text></View>
        </View>
      </View>}
      {!hasExpenses && !expanded && <Text style={styles.hint}>Sin gastos fijos todavía. Toca para ver cómo funcionan.</Text>}
    </TouchableOpacity>

    {expanded && <View style={styles.body}>
      {children}
      <TouchableOpacity activeOpacity={0.8} onPress={onAdd} style={styles.addButton} accessibilityLabel="Añadir gasto fijo"><Icon name="plus" size={16} color={colors.accent} /><Text style={styles.addText}>Añadir gasto fijo</Text></TouchableOpacity>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, marginTop: space.xl, overflow: 'hidden' },
  wrapOverdue: { borderColor: 'rgba(255, 138, 155, 0.5)' },
  header: { padding: space.lg },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.overline, color: colors.inkSoft },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  badgeText: { color: colors.danger, fontSize: 11, fontWeight: '600' },
  summary: { marginTop: space.md },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.md },
  percent: { color: colors.ink, fontSize: 30, fontWeight: '300', letterSpacing: -0.8 },
  percentLabel: { ...type.caption },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  moneyValue: { color: colors.accent, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  moneyLabel: { ...type.caption, fontSize: 11, marginTop: 2 },
  moneyMiddle: { alignItems: 'center' },
  hint: { ...type.caption, marginTop: space.sm },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  addText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
