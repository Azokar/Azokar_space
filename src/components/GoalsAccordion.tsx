import React from 'react';
import { Text, View } from 'react-native';
import Accordion, { summaryStyles } from './Accordion';
import { ProgressBar } from './ui';
import type { goalsOverview } from '../lib/goals';
import { colors, money } from '../theme';

type Props = {
  overview: ReturnType<typeof goalsOverview>;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  onAdd: () => void;
  children: React.ReactNode;
};

/** Metas financieras plegables: cerrado muestra el avance global, lo ahorrado y lo que falta. */
export default function GoalsAccordion({ overview, expanded, onToggle, onAdd, children }: Props) {
  return <Accordion
    title="METAS FINANCIERAS"
    expanded={expanded}
    onToggle={onToggle}
    onAdd={onAdd}
    addLabel="Crear meta"
    badge={overview.completed > 0 ? { text: `${overview.completed} ${overview.completed === 1 ? 'cumplida' : 'cumplidas'}`, tone: 'accent' } : undefined}
    emptyHint="Aún no tienes metas. Toca para crear la primera."
    summary={overview.count > 0 ? <>
      <View style={summaryStyles.top}>
        <Text style={summaryStyles.percent}>{overview.percent}%</Text>
        <Text style={summaryStyles.percentLabel}>de {money(overview.target)} · {overview.count} {overview.count === 1 ? 'meta' : 'metas'}</Text>
      </View>
      <ProgressBar percent={overview.percent} />
      <View style={summaryStyles.moneyRow}>
        <View><Text style={summaryStyles.moneyValue}>{money(overview.saved)}</Text><Text style={summaryStyles.moneyLabel}>Ahorrado</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={[summaryStyles.moneyValue, overview.missing > 0 && { color: colors.inkSoft }]}>{money(overview.missing)}</Text><Text style={summaryStyles.moneyLabel}>{overview.missing > 0 ? 'Falta para completarlas' : 'Todas completadas'}</Text></View>
      </View>
    </> : undefined}
  >{children}</Accordion>;
}
