import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, Icon, ProgressBar } from './ui';
import { expenseStatus, shortDate, type FixedExpense, type FixedPeriod } from '../lib/fixedExpenses';
import { colors, money, radius, space, type } from '../theme';

type Props = {
  expense: FixedExpense;
  periods: FixedPeriod[];
  today: string;
  busy: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Gasto fijo con barra de cobertura mensual, alerta de vencimiento y botón "Pagado" por quincena. */
export default function FixedExpenseCard({ expense, periods, today, busy, onTogglePaid, onEdit, onDelete }: Props) {
  const status = expenseStatus(expense, periods, today);
  const monthly = Number(expense.monthly_amount);
  return <Card style={[styles.card, status.overdue && styles.cardOverdue]}>
    <View style={styles.top}>
      <View style={styles.titleWrap}>
        <Text style={styles.name} numberOfLines={1}>{expense.name}</Text>
        <Text style={[styles.meta, status.overdue && { color: colors.danger }]}>
          {status.overdue ? 'Vencido · ' : ''}Vence el {shortDate(status.dueDate)} · {money(status.share)} por quincena
        </Text>
      </View>
      <View style={styles.amountWrap}>
        <Text style={styles.amount}>{money(monthly)}</Text>
        <Text style={styles.amountUnit}>al mes</Text>
      </View>
    </View>

    <View style={styles.progress}><ProgressBar percent={status.coveredPercent} tone={status.overdue ? 'danger' : 'accent'} /></View>
    <View style={styles.progressMeta}>
      <Text style={styles.caption}>Cubierto {status.coveredPercent}% · {money(status.reserved)} de {money(monthly)}</Text>
      <Text style={[styles.caption, status.paid ? { color: colors.accent } : status.overdue && { color: colors.danger }]}>
        {status.paid ? 'Quincena saldada' : `Pendiente ${money(status.pending)}`}
      </Text>
    </View>

    <View style={styles.actions}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onTogglePaid}
        disabled={busy}
        style={[styles.paidButton, status.paid && styles.paidButtonDone]}
        accessibilityLabel={status.paid ? `Deshacer pago de ${expense.name}` : `Marcar ${expense.name} como pagado`}
      >
        {busy ? <ActivityIndicator size="small" color={colors.accent} /> : <>
          <Icon name={status.paid ? 'rotate-ccw' : 'check'} size={14} color={status.paid ? colors.muted : colors.onAccent} />
          <Text style={[styles.paidText, status.paid && { color: colors.muted }]}>{status.paid ? 'Deshacer' : 'Pagado'}</Text>
        </>}
      </TouchableOpacity>
      <View style={styles.iconRow}>
        <TouchableOpacity onPress={onEdit} hitSlop={10} style={styles.iconButton} accessibilityLabel={`Modificar ${expense.name}`}><Icon name="edit-2" size={16} color={colors.inkSoft} /></TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={10} style={styles.iconButton} accessibilityLabel={`Eliminar ${expense.name}`}><Icon name="trash-2" size={16} color={colors.danger} /></TouchableOpacity>
      </View>
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  cardOverdue: { borderColor: 'rgba(255, 138, 155, 0.55)', backgroundColor: 'rgba(255, 138, 155, 0.07)' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  titleWrap: { flex: 1 },
  name: { ...type.heading },
  meta: { ...type.caption, marginTop: 4 },
  amountWrap: { alignItems: 'flex-end' },
  amount: { color: colors.ink, fontSize: 18, fontWeight: '300', fontVariant: ['tabular-nums'] },
  amountUnit: { ...type.caption, fontSize: 10 },
  progress: { marginTop: space.lg },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, gap: space.sm },
  caption: { ...type.caption, fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  iconRow: { flexDirection: 'row', gap: space.sm },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  paidButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 108, justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.accent },
  paidButtonDone: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lineStrong },
  paidText: { color: colors.onAccent, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
