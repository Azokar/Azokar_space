import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, Chevron, Collapsible } from './ui';
import { colors, radius, space, type } from '../theme';

export type ViewNode = React.ComponentRef<typeof View>;

type Props = {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Etiqueta del día, por ejemplo "Pecho". */
  tag?: string;
  /** Abre el editor de la etiqueta. Si no se pasa, el día no admite etiqueta. */
  onEditTag?: () => void;
  /** Es el día de hoy: se marca con una etiqueta. */
  isToday?: boolean;
  /** Hay un ejercicio arrastrándose sobre este día. */
  hovered?: boolean;
  /** Contiene la tarjeta que se está arrastrando: debe pintarse por encima del resto. */
  raised?: boolean;
  /** Algo se está arrastrando: muestra la invitación a soltar. */
  dragging?: boolean;
  setRef?: (node: ViewNode | null) => void;
  children: React.ReactNode;
};

/** Día o rutina plegable con etiqueta opcional. Es también la zona donde se suelta un ejercicio arrastrado. */
export default function DayGroup({ label, count, expanded, onToggle, tag, onEditTag, isToday, hovered, raised, dragging, setRef, children }: Props) {
  const toggle = onToggle;
  const countText = count === 0 ? 'Sin ejercicios' : `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}`;
  return <View ref={setRef} collapsable={false} style={[styles.wrap, hovered && styles.wrapHovered, dragging && !hovered && styles.wrapDropTarget, raised && styles.raised]}>
    <View style={styles.headerRow}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${label}${tag ? `, ${tag}` : ''}, ${countText}, ${expanded ? 'contraer' : 'expandir'}`}>
        <Chevron open={expanded} closedDeg={-90} openDeg={0} size={18} color={count > 0 ? colors.inkSoft : colors.muted} />
        <View style={styles.titleWrap}>
          <View style={styles.titleLine}>
            <Text style={[styles.title, count === 0 && !tag && styles.titleEmpty]}>{label.toUpperCase()}</Text>
            {isToday && <View style={styles.today}><Text style={styles.todayText}>Hoy</Text></View>}
          </View>
          {tag ? <View style={styles.tag}><Icon name="tag" size={11} color={colors.accent} /><Text style={styles.tagText} numberOfLines={1}>{tag}</Text></View> : null}
        </View>
        {hovered ? <Text style={styles.drop}>Soltar aquí</Text> : <Text style={styles.count}>{countText}</Text>}
      </TouchableOpacity>
      {onEditTag && <TouchableOpacity onPress={onEditTag} hitSlop={8} style={[styles.tagButton, !!tag && styles.tagButtonActive]} accessibilityLabel={tag ? `Cambiar la etiqueta de ${label}` : `Añadir etiqueta a ${label}`}>
        <Icon name="tag" size={15} color={tag ? colors.accent : colors.muted} />
      </TouchableOpacity>}
    </View>
    <Collapsible open={expanded}><View style={styles.body}>
      {count === 0 ? <Text style={styles.emptyHint}>Arrastra un ejercicio hasta aquí para asignarlo a este día.</Text> : children}
    </View></Collapsible>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  wrapHovered: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  wrapDropTarget: { borderStyle: 'dashed', borderColor: colors.lineStrong },
  raised: { zIndex: 50, elevation: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.md },
  header: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 14, paddingLeft: space.lg, paddingRight: space.sm },
  titleWrap: { flex: 1, gap: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...type.overline, color: colors.inkSoft },
  titleEmpty: { color: colors.muted },
  today: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  todayText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  tagText: { color: colors.accent, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  tagButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tagButtonActive: { borderColor: 'rgba(94, 234, 180, 0.4)' },
  count: { ...type.caption, fontSize: 12 },
  drop: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  body: { paddingHorizontal: space.md, paddingBottom: space.md },
  emptyHint: { ...type.caption, textAlign: 'center', paddingVertical: space.md },
});
