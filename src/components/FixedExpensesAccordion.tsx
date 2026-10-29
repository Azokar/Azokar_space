import React from 'react';
import { Text, View } from 'react-native';
import Accordion, { summaryStyles } from './Accordion';
import { ProgressBar } from './ui';
import type { fixedOverview } from '../lib/fixedExpenses';
import { colors, money } from '../theme';

type Props = {
  overview: ReturnType<typeof fixedOverview>;
  count: number;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  onAdd: () => void;
  children: React.ReactNode;
};

/** Gastos fijos plegables: cerrado muestra % cubierto, dinero reservado y faltante. */
export default function FixedExpensesAccordion({ overview, count, expanded, onToggle, onAdd, children }: Props) {
  const overdue = overview.overdueCount;
  return <Accordion
    title="GASTOS FIJOS"
    expanded={expanded}
    onToggle={onToggle}
    onAdd={onAdd}
    addLabel="Añadir gasto fijo"
    alert={overdue > 0}
    badge={overdue > 0 ? { text: `${overdue} ${overdue === 1 ? 'vencido' : 'vencidos'}`, tone: 'danger' } : undefined}
    emptyHint="Sin gastos fijos todavía. Toca para ver cómo funcionan."
    summary={count > 0 ? <>
      <View style={summaryStyles.top}>
        <Text style={summaryStyles.percent}>{overview.reservedPercent}%</Text>
        <Text style={summaryStyles.percentLabel}>cubierto de {money(overview.total)} al mes</Text>
      </View>
      <ProgressBar percent={overview.reservedPercent} tone={overdue > 0 ? 'danger' : 'accent'} />
      <View style={summaryStyles.moneyRow}>
        <View><Text style={summaryStyles.moneyValue}>{money(overview.reserved)}</Text><Text style={summaryStyles.moneyLabel}>Reservado del salario</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={[summaryStyles.moneyValue, overview.missing > 0 && { color: colors.inkSoft }]}>{money(overview.missing)}</Text><Text style={summaryStyles.moneyLabel}>{overview.missing > 0 ? 'Falta para cubrirlos' : 'Cubiertos por completo'}</Text></View>
      </View>
    </> : undefined}
  >{children}</Accordion>;
}
