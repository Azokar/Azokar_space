import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import AnimatedNumber from './AnimatedNumber';
import { MOTION_DURATION } from '../lib/motion';
import { colors, space, type } from '../theme';

export type ChartPoint = { key: string; label: string; total: number };

type Props = {
  points: ChartPoint[];
  color: string;
  /** Id único del degradado, para que dos gráficas en la misma pantalla no se pisen. */
  gradientId: string;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  height?: number;
};

const PAD = { top: 12, right: 10, bottom: 4, left: 46 };
/** Hasta este número de puntos se dibujan los círculos de datos; con más, solo la curva. */
const MAX_DOTS = 14;
/** Curva tipo "ease-out expo" (cubic-bezier(0.16, 1, 0.3, 1)): arranque rápido y frenado largo y suave. */
const EASING = Easing.bezier(0.16, 1, 0.3, 1);
const DURATION = MOTION_DURATION;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/** 1.250.000 -> "1,3M" · 85.000 -> "85k" */
export function compactMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/* ---------- Geometría de las series (en el hilo de JavaScript) ---------- */

type Shape = { xs: number[]; ys: number[] };

/** Posiciones x (0..1) de los vértices de una serie y sus valores. Una serie de 0 o 1 punto se trata como línea plana. */
function shapeOf(values: number[]): Shape {
  if (values.length > 1) return { xs: values.map((_, k) => k / (values.length - 1)), ys: values };
  const v = values[0] ?? 0;
  return { xs: [0, 1], ys: [v, v] };
}

/** Valor de una poligonal (xs ascendentes) en la posición x, por interpolación lineal. */
function evalShape(shape: Shape, x: number) {
  const { xs, ys } = shape;
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i += 1) {
    if (x <= xs[i]) { const span = xs[i] - xs[i - 1]; return span === 0 ? ys[i] : ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / span; }
  }
  return ys[ys.length - 1];
}

/** Une dos listas ordenadas de posiciones sin repetir. */
function mergeXs(a: number[], b: number[]) {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const next = j >= b.length || (i < a.length && a[i] <= b[j]) ? a[i++] : b[j++];
    if (out.length === 0 || next - out[out.length - 1] > 1e-9) out.push(next);
  }
  return out;
}

/**
 * Trazado de la curva entre dos estados según el progreso `p` (0..1). Corre en el hilo de la interfaz (worklet):
 * la animación no depende del hilo de JavaScript ni vuelve a renderizar el componente en cada fotograma.
 */
function buildPath(xs: number[], from: number[], to: number[], p: number, maxFrom: number, maxTo: number, left: number, innerW: number, top: number, innerH: number, closeArea: boolean) {
  'worklet';
  const max = maxFrom + (maxTo - maxFrom) * p;
  const baseline = top + innerH;
  let d = '';
  for (let i = 0; i < xs.length; i += 1) {
    const value = from[i] + (to[i] - from[i]) * p;
    d += `${i === 0 ? 'M' : 'L'}${(left + xs[i] * innerW).toFixed(2)},${(baseline - (value / max) * innerH).toFixed(2)}`;
  }
  if (closeArea) d += ` L${(left + xs[xs.length - 1] * innerW).toFixed(2)},${baseline} L${(left + xs[0] * innerW).toFixed(2)},${baseline} Z`;
  return d;
}

type Anim = {
  xs: SharedValue<number[]>;
  from: SharedValue<number[]>;
  to: SharedValue<number[]>;
  dotX: SharedValue<number[]>;
  dotFrom: SharedValue<number[]>;
  dotTo: SharedValue<number[]>;
  dotCount: SharedValue<number>;
  maxFrom: SharedValue<number>;
  maxTo: SharedValue<number>;
  progress: SharedValue<number>;
};

/**
 * Círculo de dato: se mueve junto con la curva durante la transición. Su posición vertical es la de la curva en su x
 * (misma interpolación y misma escala), así que siempre queda exactamente sobre la línea.
 */
function Dot({ index, anim, color, innerW, innerH }: { index: number; anim: Anim; color: string; innerW: number; innerH: number }) {
  const props = useAnimatedProps(() => {
    const active = index < anim.dotCount.value;
    const p = anim.progress.value;
    const max = anim.maxFrom.value + (anim.maxTo.value - anim.maxFrom.value) * p;
    const value = (anim.dotFrom.value[index] ?? 0) + ((anim.dotTo.value[index] ?? 0) - (anim.dotFrom.value[index] ?? 0)) * p;
    return { cx: PAD.left + (anim.dotX.value[index] ?? 0) * innerW, cy: PAD.top + innerH - (value / max) * innerH, opacity: active ? 1 : 0 };
  }, [innerW, innerH]);
  return <AnimatedCircle animatedProps={props} r={3} fill={colors.night} stroke={color} strokeWidth={2} />;
}

/**
 * Gráfica de líneas con área suave, cuadrícula, ejes y puntos seleccionables.
 * - Al cambiar los datos (periodo o categoría) la curva, los puntos y la escala se transforman con una curva de
 *   aceleración natural; al terminar, la línea coincide exactamente con los vértices de los datos.
 * - Al pasar el cursor (web) o seleccionar un punto, este crece con un resplandor suave.
 */
export default function LineChart({ points, color, gradientId, selectedKey, onSelect, height = 190 }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const reduceMotion = useReducedMotion();

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = points.reduce((top, point) => Math.max(top, point.total), 0);
  const niceMax = max > 0 ? max * 1.1 : 1;
  const x = (index: number) => PAD.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / niceMax) * innerH;

  const coords = points.map((point, index) => ({ x: x(index), y: y(point.total) }));
  const baseline = PAD.top + innerH;
  const ticks = [0, 0.5, 1].map(fraction => ({ value: niceMax * fraction, y: y(niceMax * fraction) }));
  const labelEvery = points.length > 12 ? Math.ceil(points.length / 6) : 1;
  const selectedIndex = points.findIndex(point => point.key === selectedKey);

  // ---- Estado de la animación ----
  const anim: Anim = {
    xs: useSharedValue<number[]>([0, 1]),
    from: useSharedValue<number[]>([0, 0]),
    to: useSharedValue<number[]>([0, 0]),
    dotX: useSharedValue<number[]>([]),
    dotFrom: useSharedValue<number[]>([]),
    dotTo: useSharedValue<number[]>([]),
    dotCount: useSharedValue(0),
    maxFrom: useSharedValue(1),
    maxTo: useSharedValue(1),
    progress: useSharedValue(1),
  };
  const lastShape = useRef<{ shape: Shape; max: number }>({ shape: { xs: [0, 1], ys: [0, 0] }, max: 1 });
  const [settled, setSettled] = useState(true);

  // La firma evita relanzar la animación cuando el padre crea un arreglo nuevo con los mismos valores.
  const signature = points.map(point => point.total).join(',');
  useEffect(() => {
    if (width === 0) return;
    const values = points.map(point => point.total);
    const next = shapeOf(values);

    // Estado de partida: lo que se ve ahora mismo (si hay una animación a medias, esa forma intermedia).
    const p = anim.progress.value;
    let baseShape = lastShape.current.shape;
    let baseMax = lastShape.current.max;
    if (p < 0.999) {
      const xsNow = anim.xs.value;
      baseShape = { xs: xsNow, ys: xsNow.map((_, i) => anim.from.value[i] + (anim.to.value[i] - anim.from.value[i]) * p) };
      baseMax = anim.maxFrom.value + (anim.maxTo.value - anim.maxFrom.value) * p;
    }

    // Se muestrea en la unión de los vértices de ambas formas: así cada una se reproduce exactamente.
    const union = mergeXs(baseShape.xs, next.xs);
    anim.xs.value = union;
    anim.from.value = union.map(position => evalShape(baseShape, position));
    anim.to.value = union.map(position => evalShape(next, position));
    anim.maxFrom.value = baseMax;
    anim.maxTo.value = niceMax;

    // Los puntos nacen sobre la curva de partida y viajan hasta su valor final.
    const showDots = values.length >= 1 && values.length <= MAX_DOTS;
    const dotPositions = values.length > 1 ? values.map((_, k) => k / (values.length - 1)) : [0.5];
    anim.dotX.value = showDots ? dotPositions : [];
    anim.dotFrom.value = showDots ? dotPositions.map(position => evalShape(baseShape, position)) : [];
    anim.dotTo.value = showDots ? values : [];
    anim.dotCount.value = showDots ? values.length : 0;
    lastShape.current = { shape: next, max: niceMax };

    if (reduceMotion) { anim.progress.value = 1; setSettled(true); return; }
    setSettled(false);
    anim.progress.value = 0;
    anim.progress.value = withTiming(1, { duration: DURATION, easing: EASING });
    const timer = setTimeout(() => setSettled(true), DURATION);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, width, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ d: buildPath(anim.xs.value, anim.from.value, anim.to.value, anim.progress.value, anim.maxFrom.value, anim.maxTo.value, PAD.left, innerW, PAD.top, innerH, false) }), [innerW, innerH]);
  const areaProps = useAnimatedProps(() => ({ d: buildPath(anim.xs.value, anim.from.value, anim.to.value, anim.progress.value, anim.maxFrom.value, anim.maxTo.value, PAD.left, innerW, PAD.top, innerH, true) }), [innerW, innerH]);

  // ---- Punto enfocado (cursor encima o seleccionado): crece con un resplandor ----
  const [hover, setHover] = useState<number | null>(null);
  const focusIndex = hover !== null ? hover : selectedIndex >= 0 ? selectedIndex : null;
  const [shownFocus, setShownFocus] = useState<number | null>(null);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (focusIndex !== null && settled) { setShownFocus(focusIndex); glow.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }); }
    else glow.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
  }, [focusIndex, settled, glow]);
  const guideProps = useAnimatedProps(() => ({ opacity: glow.value }));
  const haloProps = useAnimatedProps(() => ({ r: 4 + glow.value * 8, opacity: glow.value * 0.22 }));
  const coreProps = useAnimatedProps(() => ({ r: 3 + glow.value * 2.5, opacity: glow.value }));
  const focus = shownFocus !== null && shownFocus < coords.length ? coords[shownFocus] : null;

  const drawCurve = points.length > 1;

  return <View onLayout={onLayout} style={{ height: height + 22 }}>
    {width > 0 && <>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map(tick => <Line key={tick.value} x1={PAD.left} x2={width - PAD.right} y1={tick.y} y2={tick.y} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />)}
        {drawCurve && <AnimatedPath animatedProps={areaProps} fill={`url(#${gradientId})`} />}
        {drawCurve && <AnimatedPath animatedProps={lineProps} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {Array.from({ length: MAX_DOTS }, (_, index) => <Dot key={index} index={index} anim={anim} color={color} innerW={innerW} innerH={innerH} />)}
        {focus && <AnimatedG animatedProps={guideProps}>
          <Line x1={focus.x} x2={focus.x} y1={PAD.top} y2={baseline} stroke={colors.lineStrong} strokeWidth={1} />
        </AnimatedG>}
        {focus && <AnimatedCircle cx={focus.x} cy={focus.y} animatedProps={haloProps} fill={color} />}
        {focus && <AnimatedCircle cx={focus.x} cy={focus.y} animatedProps={coreProps} fill={color} stroke={colors.night} strokeWidth={2} />}
      </Svg>

      {/* Claves estables por posición: así cada etiqueta cuenta desde su valor anterior y no desde cero. */}
      {ticks.map((tick, index) => <AnimatedNumber key={`tick-${index}`} value={tick.value} format={compactMoney} style={[styles.tick, { top: tick.y - 7 }]} />)}

      <View style={[styles.labels, { top: height + 4, left: PAD.left, width: innerW }]} pointerEvents="none">
        {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1
          ? <Text key={point.key} style={[styles.xLabel, { left: x(index) - PAD.left - 20 }]} numberOfLines={1}>{point.label}</Text> : null)}
      </View>

      {/* Zonas táctiles: una columna por punto (en web también reaccionan al cursor) */}
      <View style={[StyleSheet.absoluteFill, { height }]}>
        {points.map((point, index) => {
          const slot = innerW / Math.max(1, points.length - 1);
          return <Pressable
            key={point.key}
            onPress={() => onSelect(point.key === selectedKey ? null : point.key)}
            onHoverIn={() => setHover(index)}
            onHoverOut={() => setHover(current => (current === index ? null : current))}
            style={{ position: 'absolute', top: 0, bottom: 0, left: x(index) - Math.max(slot, 14) / 2, width: Math.max(slot, 14) }}
            accessibilityLabel={`${point.key}: ${point.total}`}
          />;
        })}
      </View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  tick: { ...type.caption, position: 'absolute', left: 0, width: PAD.left - 8, textAlign: 'right', fontSize: 11, fontVariant: ['tabular-nums'] },
  labels: { position: 'absolute', height: 16 },
  xLabel: { ...type.caption, position: 'absolute', width: 40, textAlign: 'center', fontSize: 11, marginTop: space.xs / 2 },
});
