import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, Chevron, Collapsible } from './ui';
import { colors, radius, space, type } from '../theme';

export type AccordionProps = {
  title: string;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  onAdd: () => void;
  addLabel: string;
  /** Insignia junto al chevron (por ejemplo "2 vencidos"). */
  badge?: { text: string; tone: 'danger' | 'accent' };
  /** Resalta el borde en rojo. */
  alert?: boolean;
  /** Vista rápida visible solo con la sección cerrada. Si no hay, se muestra `emptyHint`. */
  summary?: React.ReactNode;
  emptyHint?: string;
  children: React.ReactNode;
};

/** Sección plegable genérica: cerrada muestra un resumen; abierta, el contenido y el botón de añadir. */
export default function Accordion({ title, expanded, onToggle, onAdd, addLabel, badge, alert, summary, emptyHint, children }: AccordionProps) {
  const toggle = () => onToggle(!expanded);
  return <View style={[styles.wrap, alert && styles.wrapAlert]}>
    <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${title}, ${expanded ? 'contraer' : 'expandir'}`}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {badge && <View style={[styles.badge, badge.tone === 'accent' && styles.badgeAccent]}><Text style={[styles.badgeText, badge.tone === 'accent' && { color: colors.accent }]}>{badge.text}</Text></View>}
          <Chevron open={expanded} size={18} color={colors.muted} />
        </View>
      </View>
      {(summary || emptyHint) ? <Collapsible open={!expanded}>{summary ? <View style={styles.summary}>{summary}</View> : <Text style={styles.hint}>{emptyHint}</Text>}</Collapsible> : null}
    </TouchableOpacity>

    <Collapsible open={expanded}><View style={styles.body}>
      {children}
      <TouchableOpacity activeOpacity={0.8} onPress={onAdd} style={styles.addButton} accessibilityLabel={addLabel}><Icon name="plus" size={16} color={colors.accent} /><Text style={styles.addText}>{addLabel}</Text></TouchableOpacity>
    </View></Collapsible>
  </View>;
}

/** Estilos reutilizables para el resumen de las secciones plegables. */
export const summaryStyles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.md },
  percent: { color: colors.ink, fontSize: 30, fontWeight: '300', letterSpacing: -0.8 },
  percentLabel: { ...type.caption },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  moneyValue: { color: colors.accent, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  moneyLabel: { ...type.caption, fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, marginTop: space.xl, overflow: 'hidden' },
  wrapAlert: { borderColor: 'rgba(255, 138, 155, 0.5)' },
  header: { padding: space.lg },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.overline, color: colors.inkSoft },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  badgeAccent: { backgroundColor: colors.accentGlow },
  badgeText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  summary: { marginTop: space.md },
  hint: { ...type.caption, marginTop: space.sm },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  addText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
