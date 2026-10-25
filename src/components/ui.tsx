import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 18, color = colors.inkSoft }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={color} />;

/** Campo de estrellas determinista (misma disposición en cada render) con parpadeo muy lento. */
export function Starfield() {
  const stars = useMemo(() => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return Array.from({ length: 44 }, (_, index) => ({ key: index, left: `${rand() * 100}%` as const, top: `${rand() * 100}%` as const, size: rand() > 0.88 ? 2.2 : 1.2, base: 0.2 + rand() * 0.45, twinkle: index % 5 === 0 }));
  }, []);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {[0, 1, 2, 3].map(layer => <View key={layer} style={[styles.horizon, { top: -300 + layer * 36, left: -160 + layer * 36, right: -160 + layer * 36, height: 520 - layer * 72 }]} />)}
    {stars.map(star => star.twinkle
      ? <Animated.View key={star.key} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [star.base * 0.4, star.base + 0.3] }) }]} />
      : <View key={star.key} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.base }]} />)}
  </View>;
}

export function Card({ children, style, glow }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction, meta }: { title: string; action?: string; onAction?: () => void; meta?: string }) {
  return <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action ? <TouchableOpacity onPress={onAction} hitSlop={10}><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity> : meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
  </View>;
}

export function Button({ label, onPress, busy, variant = 'primary', icon, style }: { label: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'ghost' | 'danger'; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.accent;
  return <TouchableOpacity activeOpacity={0.8} onPress={onPress} disabled={busy} style={[styles.button, variant === 'primary' && styles.buttonPrimary, variant === 'ghost' && styles.buttonGhost, variant === 'danger' && styles.buttonDanger, busy && { opacity: 0.7 }, style]}>
    {busy ? <ActivityIndicator color={fg} /> : <View style={styles.buttonInner}>{icon && <Icon name={icon} size={16} color={fg} />}<Text style={[styles.buttonText, { color: fg }]}>{label}</Text></View>}
  </TouchableOpacity>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return <View style={styles.fieldWrap}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <TextInput placeholderTextColor={colors.muted} selectionColor={colors.accent} {...props} style={[styles.input, style]} />
  </View>;
}

export function Chip({ label, selected, onPress, round }: { label: string; selected?: boolean; onPress: () => void; round?: boolean }) {
  return <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.chip, round && styles.chipRound, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></TouchableOpacity>;
}

export function ProgressBar({ percent, tone = 'accent' }: { percent: number; tone?: 'accent' | 'danger' }) {
  return <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }, tone === 'danger' && { backgroundColor: colors.danger }]} /></View>;
}

export function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, accent && { color: colors.accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export function Checkbox({ done, busy, round }: { done: boolean; busy?: boolean; round?: boolean }) {
  return <View style={[styles.check, round && { borderRadius: 12 }, done && styles.checkDone]}>{busy ? <ActivityIndicator size="small" color={colors.accent} /> : done ? <Icon name="check" size={14} color={colors.onAccent} /> : null}</View>;
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return <View style={styles.empty}><Icon name={icon} size={20} color={colors.muted} /><Text style={styles.emptyText}>{text}</Text></View>;
}

export const ErrorText = ({ children }: { children?: string }) => (children ? <Text style={styles.error}>{children}</Text> : null);

const styles = StyleSheet.create({
  horizon: { position: 'absolute', borderRadius: 600, backgroundColor: 'rgba(94, 234, 180, 0.012)' },
  star: { position: 'absolute', borderRadius: 4, backgroundColor: '#DDE8F7' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: space.lg },
  cardGlow: { borderColor: 'rgba(94, 234, 180, 0.22)', backgroundColor: colors.surfaceRaised },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
  sectionTitle: { ...type.overline, color: colors.inkSoft, textTransform: 'uppercase' },
  sectionAction: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  sectionMeta: { ...type.caption },
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'transparent' },
  buttonDanger: { borderWidth: 1, borderColor: 'rgba(255, 138, 155, 0.35)', backgroundColor: colors.dangerSoft },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  fieldWrap: { marginTop: space.lg },
  fieldLabel: { ...type.overline, marginBottom: 8 },
  input: { height: 52, backgroundColor: colors.night, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space.lg, color: colors.ink, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.night, marginRight: 8 },
  chipRound: { width: 40, height: 40, paddingHorizontal: 0, paddingVertical: 0, marginRight: 0, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.accent },
  track: { height: 4, borderRadius: 4, backgroundColor: 'rgba(160, 190, 230, 0.12)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 4, backgroundColor: colors.accent },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: space.lg, paddingHorizontal: space.md },
  metricValue: { color: colors.ink, fontSize: 26, fontWeight: '300', letterSpacing: -0.5 },
  metricLabel: { ...type.caption, fontSize: 11, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  emptyText: { ...type.caption, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  error: { color: colors.danger, fontSize: 12, marginTop: space.md, lineHeight: 18 },
});
