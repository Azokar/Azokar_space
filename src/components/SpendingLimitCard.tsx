import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, Chevron, Collapsible, Icon, ProgressBar } from './ui';
import type { limitSummary } from '../lib/spendingLimit';
import { colors, money, radius, space, type } from '../theme';

type Props = {
  monthly: number | null;
  summary: ReturnType<typeof limitSummary> | null;
  onEdit: () => void;
};

/**
 * Presupuesto de la quincena. Cerrado muestra lo esencial (cuánto te queda para gastos variables y la barra);
 * el desprendible abre el desglose: recibido, límite, gastos fijos programados, variables y el mes.
 */
export default function SpendingLimitCard({ monthly, summary, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(value => !value);

  if (monthly === null || !summary) {
    return <TouchableOpacity activeOpacity={0.8} onPress={onEdit} style={styles.empty} accessibilityLabel="Definir límite de gastos mensual">
      <View style={styles.emptyIcon}><Icon name="shield" size={18} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>Límite de gastos</Text>
        <Text style={[type.caption, { marginTop: 3 }]}>Define un tope mensual y se divide por quincena.</Text>
      </View>
      <Icon name="plus" size={18} color={colors.accent} />
    </TouchableOpacity>;
  }

  const tone = summary.exceeded ? colors.danger : colors.accent;
  const near = !summary.exceeded && summary.percent >= 80;
  const status = summary.exceeded ? 'Límite superado' : near ? 'Cerca del límite' : `${summary.percent}% usado`;

  return <Card glow={!summary.exceeded && !near} style={[styles.card, summary.exceeded && styles.cardExceeded]}>
    <View style={styles.top}>
      <Text style={type.overline}>PRESUPUESTO · {summary.quincena.label.toUpperCase()}</Text>
      <TouchableOpacity onPress={onEdit} hitSlop={10} accessibilityLabel="Modificar límite de gastos"><Icon name="edit-2" size={16} color={colors.inkSoft} /></TouchableOpacity>
    </View>

    <View style={styles.headline}>
      <Text style={[styles.amount, { color: tone }]}>{summary.available < 0 ? '− ' : ''}{money(Math.abs(summary.available))}</Text>
      <Text style={styles.amountLabel}>{summary.exceeded ? 'de más en gastos variables' : 'para gastos variables'}</Text>
    </View>

    <View style={{ marginTop: space.md }}><ProgressBar percent={summary.percent} tone={summary.exceeded ? 'danger' : 'accent'} /></View>
    <View style={styles.statusRow}>
      <Text style={[styles.status, { color: summary.exceeded ? colors.danger : near ? colors.inkSoft : colors.muted }]}>{status}</Text>
      <Text style={styles.usage}>{money(summary.committed)} de {money(summary.quincenaLimit)}</Text>
    </View>

    <TouchableOpacity activeOpacity={0.7} onPress={toggle} style={styles.toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Ocultar el detalle del presupuesto' : 'Ver el detalle del presupuesto'}>
      <Text style={styles.toggleText}>{open ? 'Ocultar detalle' : 'Ver detalle'}</Text>
      <Chevron open={open} size={16} color={colors.muted} />
    </TouchableOpacity>

    <Collapsible open={open}><View style={styles.detail}>
      <Line label="Recibido en la quincena" value={money(summary.received)} />
      <Line label="Límite de la quincena" value={money(summary.quincenaLimit)} strong />
      <Line label="Gastos fijos programados" value={`− ${money(summary.fixedProgrammed)}`} hint="cuentan estén pagados o no" />
      <Line label="Gastos variables" value={`− ${money(summary.variableSpent)}`} />
      <View style={styles.month}>
        <Text style={styles.monthTitle}>EL MES</Text>
        <Text style={type.caption}>Fijos {money(summary.monthFixed)} + variables {money(summary.monthVariable)} de {money(monthly)}</Text>
        <Text style={[type.caption, { color: summary.monthRemaining >= 0 ? colors.inkSoft : colors.danger }]}>{summary.monthRemaining >= 0 ? `Restan ${money(summary.monthRemaining)}` : `Excedido en ${money(-summary.monthRemaining)}`}</Text>
      </View>
    </View></Collapsible>
  </Card>;
}

function Line({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return <View style={styles.line}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.lineLabel, strong && { color: colors.ink }]}>{label}</Text>
      {hint ? <Text style={styles.lineHint}>{hint}</Text> : null}
    </View>
    <Text style={[styles.lineValue, strong && { color: colors.ink, fontWeight: '600' }]}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentGlow, alignItems: 'center', justifyContent: 'center' },
  card: { paddingVertical: space.lg },
  cardExceeded: { borderColor: 'rgba(255, 138, 155, 0.5)', backgroundColor: 'rgba(255, 138, 155, 0.06)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  amount: { fontSize: 30, fontWeight: '200', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  amountLabel: { ...type.caption },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, gap: space.sm },
  status: { fontSize: 12, fontWeight: '500' },
  usage: { ...type.caption, fontSize: 12, fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  toggleText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  detail: { marginTop: space.xs },
  line: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: space.md },
  lineLabel: { ...type.caption, fontSize: 13 },
  lineHint: { ...type.caption, fontSize: 11, marginTop: 1 },
  lineValue: { color: colors.inkSoft, fontSize: 13, fontVariant: ['tabular-nums'] },
  month: { marginTop: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 3 },
  monthTitle: { ...type.overline, fontSize: 11, marginBottom: 2 },
});
