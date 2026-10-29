import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Reanimated, { Easing as REasing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { MOTION_BASE, MOTION_DURATION, MOTION_FAST, MOTION_EXIT, PRESS_SCALE, SPRING, STAGGER_MAX_ITEMS, STAGGER_MS } from '../lib/motion';
import { colors, radius, space, type } from '../theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 18, color = colors.inkSoft }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={color} />;

// Transición suave solo en web (en el teléfono el cambio de estado es inmediato y el feedback va por animación nativa).
const webTransition = (Platform.OS === 'web' ? { transitionProperty: 'background-color, border-color, box-shadow, transform, opacity', transitionDuration: `${MOTION_BASE - 40}ms`, transitionTimingFunction: 'ease' } : {}) as ViewStyle;
/** Anillo de foco visible para teclado (web y lectores externos): 3 px, con contraste suficiente sobre el fondo oscuro. */
const FOCUS_RING = { boxShadow: '0 0 0 3px rgba(94, 234, 180, 0.45)' } as ViewStyle;

/** Campo de estrellas determinista (misma disposición en cada render) con parpadeo muy lento. Sin parpadeo si se reduce el movimiento. */
export function Starfield() {
  const reduceMotion = useReducedMotion();
  const stars = useMemo(() => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return Array.from({ length: 44 }, (_, index) => ({ key: index, left: `${rand() * 100}%` as const, top: `${rand() * 100}%` as const, size: rand() > 0.88 ? 2.2 : 1.2, base: 0.2 + rand() * 0.45, twinkle: index % 5 === 0 }));
  }, []);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {[0, 1, 2, 3].map(layer => <View key={layer} style={[styles.horizon, { top: -300 + layer * 36, left: -160 + layer * 36, right: -160 + layer * 36, height: 520 - layer * 72 }]} />)}
    {stars.map(star => star.twinkle && !reduceMotion
      ? <Animated.View key={star.key} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [star.base * 0.4, star.base + 0.3] }) }]} />
      : <View key={star.key} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.base }]} />)}
  </View>;
}

export function Card({ children, style, glow }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

/**
 * Entrada de un bloque o fila: aparece desde abajo con un fundido corto. Si va en una lista, `index` escalona la
 * entrada (40 ms por elemento, máximo 7) para que se lea como una sola secuencia y nunca haga esperar.
 * Con "reducir movimiento" el elemento aparece directamente.
 */
export function Reveal({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const delay = Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_MS;
  // Valores compartidos en lugar de `entering`: en web ese modo saca el elemento del flujo (position: absolute).
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) { progress.value = 1; return; }
    progress.value = withDelay(delay, withTiming(1, { duration: MOTION_BASE + 60, easing: REasing.out(REasing.cubic) }));
  }, [delay, reduceMotion, progress]);
  const reveal = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 10 }] }));
  return <Reanimated.View style={[reveal, style]}>{children}</Reanimated.View>;
}

export function SectionHeader({ title, action, onAction, meta }: { title: string; action?: string; onAction?: () => void; meta?: string }) {
  return <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
    {action ? <TouchableOpacity onPress={onAction} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} accessibilityRole="button"><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity> : meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
  </View>;
}

/**
 * Botón con feedback al pulsar: se encoge un 3 % con un resorte (la animación va en el hilo de la interfaz) y
 * recupera su tamaño al soltar. Solo cambia `transform`, así que no mueve nada alrededor. Muestra anillo de foco con teclado.
 */
export function Button({ label, onPress, busy, variant = 'primary', icon, style }: { label: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'ghost' | 'danger'; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.accent;
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Reanimated.View style={[styles.buttonWrap, style, press]}>
    <Pressable
      onPress={onPress}
      onPressIn={() => { if (!reduceMotion) scale.value = withTiming(PRESS_SCALE, { duration: 90 }); }}
      onPressOut={() => { if (!reduceMotion) scale.value = withSpring(1, SPRING); }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      style={(state: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [styles.button, webTransition, variant === 'primary' && styles.buttonPrimary, variant === 'ghost' && styles.buttonGhost, variant === 'danger' && styles.buttonDanger, state.hovered && styles.buttonHover, state.pressed && styles.buttonPressed, state.focused && FOCUS_RING, busy && { opacity: 0.7 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <View style={styles.buttonInner}>{icon && <Icon name={icon} size={16} color={fg} />}<Text style={[styles.buttonText, { color: fg }]}>{label}</Text></View>}
    </Pressable>
  </Reanimated.View>;
}

/**
 * Campo de texto con etiqueta visible. Al enfocarlo resalta el borde con un halo; si hay `error` lo marca en rojo y
 * muestra el mensaje justo debajo (anunciado por lectores de pantalla); `helper` es una ayuda permanente.
 */
export function Field({ label, style, error, helper, trailing, onFocus, onBlur, ...props }: TextInputProps & { label?: string; error?: string; helper?: string; trailing?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.fieldWrap}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <View>
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      accessibilityLabel={label ?? props.placeholder}
      accessibilityHint={error || undefined}
      {...props}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[styles.input, webTransition, focused && styles.inputFocused, !!error && styles.inputError, !!trailing && styles.inputWithTrailing, style]}
    />
    {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
    {error ? <Text style={styles.fieldError} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
  </View>;
}

type ChipState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/**
 * Botón de filtro. Su tamaño y forma son idénticos en reposo, con el cursor encima, pulsado o seleccionado:
 * el borde siempre mide 1 px y el texto conserva peso y tamaño. La selección solo cambia colores y un halo
 * (que no ocupa espacio), así que no se mueve nada alrededor. El área táctil se amplía a 44 px de alto.
 */
export function Chip({ label, selected, onPress, round }: { label: string; selected?: boolean; onPress: () => void; round?: boolean }) {
  return <Pressable
    onPress={onPress}
    hitSlop={round ? 2 : { top: 4, bottom: 4, left: 2, right: 2 }}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: !!selected }}
    style={(state: ChipState) => [styles.chip, round && styles.chipRound, webTransition, state.hovered && !selected && styles.chipHover, selected && styles.chipSelected, state.pressed && styles.chipPressed, state.focused && FOCUS_RING]}
  >
    <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

/**
 * Contenedor de botones de filtro. Por defecto los reparte en varias líneas si no caben (`gap` uniforme);
 * con `scroll` los deja en una sola fila que se desliza de lado, sin barra de desplazamiento.
 */
export function ChipRow({ children, scroll, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (scroll) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipScroll, style]} contentContainerStyle={styles.chipRowContent}>{children}</ScrollView>;
  }
  return <View style={[styles.chipRow, style]}>{children}</View>;
}

/** Barra de progreso: el relleno crece o se encoge con `transform` (sin animar el ancho) y anuncia su valor. */
export function ProgressBar({ percent, tone = 'accent' }: { percent: number; tone?: 'accent' | 'danger' }) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(100, percent)) / 100;
  const progress = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    progress.value = reduceMotion ? target : withTiming(target, { duration: MOTION_DURATION, easing: REasing.bezier(0.16, 1, 0.3, 1) });
  }, [target, reduceMotion, progress]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}>
    <Reanimated.View style={[styles.fill, tone === 'danger' && { backgroundColor: colors.danger }, fill]} />
  </View>;
}

export function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, accent && { color: colors.accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

/** Casilla: al marcarla hace un pequeño "pop" con resorte, que confirma la acción. No anima al aparecer ya marcada. */
export function Checkbox({ done, busy, round }: { done: boolean; busy?: boolean; round?: boolean }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (done && !reduceMotion) { scale.value = 0.78; scale.value = withSpring(1, SPRING); }
  }, [done, reduceMotion, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Reanimated.View style={[styles.check, round && { borderRadius: 12 }, done && styles.checkDone, webTransition, pop]}>
    {busy ? <ActivityIndicator size="small" color={colors.accent} /> : done ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
  </Reanimated.View>;
}

/** Flecha que gira con suavidad al abrir o cerrar una sección (en lugar de cambiar de icono de golpe). */
export function Chevron({ open, size = 18, color = colors.muted, closedDeg = 0, openDeg = 180 }: { open: boolean; size?: number; color?: string; closedDeg?: number; openDeg?: number }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(open ? openDeg : closedDeg);
  useEffect(() => {
    const target = open ? openDeg : closedDeg;
    rotation.value = reduceMotion ? target : withTiming(target, { duration: MOTION_BASE - 40, easing: REasing.out(REasing.cubic) });
  }, [open, openDeg, closedDeg, reduceMotion, rotation]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Reanimated.View style={turn}><Icon name="chevron-down" size={size} color={color} /></Reanimated.View>;
}

/**
 * Contenido plegable: al abrir, la altura crece con la curva de la app y el contenido se funde; al cerrar sale más
 * rápido (~65 %). El contenido solo existe mientras está abierto o animándose. En reposo abierto no recorta nada
 * (así una tarjeta arrastrada puede salir de la sección). Con "reducir movimiento" cambia sin animación.
 */
export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  const settled = useSharedValue(open ? 1 : 0);
  const contentHeight = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (open) {
      setMounted(true);
      settled.value = 0;
      if (reduceMotion) { progress.value = 1; settled.value = 1; return; }
      progress.value = withTiming(1, { duration: MOTION_BASE + 60, easing: REasing.bezier(0.16, 1, 0.3, 1) }, finished => { if (finished) settled.value = 1; });
      return;
    }
    settled.value = 0;
    if (reduceMotion) { progress.value = 0; setMounted(false); return; }
    progress.value = withTiming(0, { duration: MOTION_EXIT, easing: REasing.bezier(0.16, 1, 0.3, 1) });
    const timer = setTimeout(() => setMounted(false), MOTION_EXIT + 30);
    return () => clearTimeout(timer);
  }, [open, reduceMotion, progress, settled]);
  const frame = useAnimatedStyle(() => ({ height: progress.value * contentHeight.value, opacity: progress.value, overflow: settled.value === 1 ? 'visible' : 'hidden' }));
  if (!mounted) return null;
  return <Reanimated.View style={frame} pointerEvents={open ? 'auto' : 'none'}>
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }} onLayout={event => { contentHeight.value = event.nativeEvent.layout.height; }}>{children}</View>
  </Reanimated.View>;
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return <Reveal><View style={styles.empty}><Icon name={icon} size={20} color={colors.muted} /><Text style={styles.emptyText}>{text}</Text></View></Reveal>;
}

/**
 * Marcador de carga con la forma del contenido que va a aparecer (más claro que un spinner suelto y sin saltos de
 * diseño al llegar los datos). Pulsa suavemente; con "reducir movimiento" queda fijo.
 */
export function Skeleton({ height = 16, width, radius: corner = 10, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 0.7 : 0.45);
  useEffect(() => {
    if (reduceMotion) { opacity.value = 0.7; return; }
    opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 850, easing: REasing.inOut(REasing.quad) }), withTiming(0.45, { duration: 850, easing: REasing.inOut(REasing.quad) })), -1, false);
  }, [reduceMotion, opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Reanimated.View style={[{ height, width: width ?? '100%', borderRadius: corner, backgroundColor: 'rgba(160, 190, 230, 0.10)' }, pulse, style]} />;
}

/** Varias filas de carga con el aspecto de las tarjetas de lista. Se anuncia como "Cargando" a los lectores de pantalla. */
export function SkeletonList({ count = 3, rowHeight = 64, gap = space.sm }: { count?: number; rowHeight?: number; gap?: number }) {
  return <View style={{ gap }} accessibilityLabel="Cargando" accessibilityState={{ busy: true }} accessibilityLiveRegion="polite">
    {Array.from({ length: count }, (_, index) => <Skeleton key={index} height={rowHeight} radius={18} />)}
  </View>;
}

export const ErrorText = ({ children }: { children?: string }) => (children ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{children}</Text> : null);

const styles = StyleSheet.create({
  horizon: { position: 'absolute', borderRadius: 600, backgroundColor: 'rgba(94, 234, 180, 0.012)' },
  star: { position: 'absolute', borderRadius: 4, backgroundColor: '#DDE8F7' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: space.lg },
  cardGlow: { borderColor: 'rgba(94, 234, 180, 0.22)', backgroundColor: colors.surfaceRaised },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
  sectionTitle: { ...type.overline, color: colors.inkSoft, textTransform: 'uppercase' },
  sectionAction: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  sectionMeta: { ...type.caption },
  buttonWrap: { marginTop: space.lg },
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'transparent' },
  buttonDanger: { borderWidth: 1, borderColor: 'rgba(255, 138, 155, 0.35)', backgroundColor: colors.dangerSoft },
  buttonHover: { opacity: 0.92 },
  buttonPressed: { opacity: 0.85 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  fieldWrap: { marginTop: space.lg },
  fieldLabel: { ...type.overline, marginBottom: 8 },
  input: { height: 52, backgroundColor: colors.night, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space.lg, color: colors.ink, fontSize: 16 },
  inputFocused: { borderColor: colors.accent, boxShadow: '0 0 0 3px rgba(94, 234, 180, 0.16)' },
  inputError: { borderColor: colors.danger, boxShadow: '0 0 0 3px rgba(255, 138, 155, 0.14)' },
  inputWithTrailing: { paddingRight: 76 },
  trailing: { position: 'absolute', right: 0, top: 0, height: 52, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 6 },
  fieldHelper: { ...type.caption, marginTop: 6, lineHeight: 17 },
  chip: { minHeight: 36, flexShrink: 0, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  chipRound: { width: 40, height: 40, minHeight: 0, paddingHorizontal: 0, paddingVertical: 0 },
  chipHover: { backgroundColor: colors.surfaceRaised, borderColor: colors.lineStrong },
  chipSelected: { backgroundColor: colors.accentGlow, borderColor: colors.accent, boxShadow: '0 0 14px rgba(94, 234, 180, 0.25)' },
  chipPressed: { transform: [{ scale: PRESS_SCALE }] },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  chipTextSelected: { color: colors.accent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipScroll: { flexGrow: 0 },
  chipRowContent: { flexDirection: 'row', gap: 8, paddingRight: 20, paddingVertical: 4 },
  track: { height: 4, borderRadius: 4, backgroundColor: 'rgba(160, 190, 230, 0.12)', overflow: 'hidden' },
  fill: { height: 4, width: '100%', borderRadius: 4, backgroundColor: colors.accent, transformOrigin: 'left center' },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: space.lg, paddingHorizontal: space.md },
  metricValue: { color: colors.ink, fontSize: 26, fontWeight: '300', letterSpacing: -0.5 },
  metricLabel: { ...type.caption, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  emptyText: { ...type.caption, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  error: { color: colors.danger, fontSize: 12, marginTop: space.md, lineHeight: 18 },
});
