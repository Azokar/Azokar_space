import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { Easing as REasing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedNumber from './AnimatedNumber';
import { Icon } from './ui';
import { MOTION_DURATION, SPRING } from '../lib/motion';
import { MOON_GOAL, POINTS_FAIL, POINTS_SUCCESS } from '../lib/habitPoints';
import { colors, radius, space, type } from '../theme';

type Props = {
  points: number;
  /** Texto bajo la barra: qué pasa si hoy se completa o no. */
  hint?: string;
};

/** "Camino a la Luna": barra de 0 a 100 puntos con un cohete que avanza hacia la Luna. */
export default function MoonProgress({ points, hint }: Props) {
  const pct = Math.max(0, Math.min(100, (points / MOON_GOAL) * 100));
  const arrived = points >= MOON_GOAL;

  // El relleno y el cohete avanzan juntos con la misma curva; solo se animan transform y opacidad.
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(reduceMotion ? pct / 100 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? pct / 100 : withTiming(pct / 100, { duration: MOTION_DURATION, easing: REasing.bezier(0.16, 1, 0.3, 1) });
  }, [pct, reduceMotion, progress]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const rocketStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * trackWidth }] }), [trackWidth]);
  // Al llegar a la Luna (no al abrir la pantalla), la Luna "late" una vez.
  const moonScale = useSharedValue(1);
  const wasArrived = useRef(arrived);
  useEffect(() => {
    if (arrived && !wasArrived.current && !reduceMotion) { moonScale.value = 0.8; moonScale.value = withSpring(1, SPRING); }
    wasArrived.current = arrived;
  }, [arrived, reduceMotion, moonScale]);
  const moonStyle = useAnimatedStyle(() => ({ transform: [{ scale: moonScale.value }] }));

  // Estrellas fijas sobre el trayecto (misma disposición en cada render).
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ key: i, left: 6 + ((i * 37) % 88), top: ((i * 53) % 24) - 4, size: i % 4 === 0 ? 2 : 1.2 })), []);

  return <View style={[styles.card, arrived && styles.cardArrived]}>
    <View style={styles.top}>
      <Text style={type.overline}>CAMINO A LA LUNA</Text>
      <Text style={styles.points}><AnimatedNumber value={points} style={styles.pointsValue} /> / {MOON_GOAL}</Text>
    </View>

    <View style={styles.route}>
      <View style={styles.earth}><Icon name="globe" size={16} color={colors.inkSoft} /></View>
      <View style={styles.trackWrap} onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}>
        {stars.map(star => <View key={star.key} style={[styles.star, { left: `${star.left}%`, top: 14 + star.top, width: star.size, height: star.size }]} />)}
        <View style={styles.track}><Reanimated.View style={[styles.fill, fillStyle]} /></View>
        <Reanimated.View style={[styles.rocket, rocketStyle]}>
          <View style={styles.rocketBody}><MaterialCommunityIcons name="rocket-launch" size={17} color={colors.onAccent} style={styles.rocketIcon} /></View>
        </Reanimated.View>
      </View>
      <Reanimated.View style={[styles.moon, arrived && styles.moonArrived, moonStyle]}><Icon name="moon" size={18} color={arrived ? colors.onAccent : colors.inkSoft} /></Reanimated.View>
    </View>

    <View style={styles.ticks}>{[0, 25, 50, 75, 100].map(mark => <Text key={mark} style={styles.tick}>{mark}</Text>)}</View>

    <Text style={[styles.message, arrived && { color: colors.accent }]}>
      {arrived ? '¡Llegaste a la Luna!' : points === 0 ? 'Despega: completa todos tus hábitos para ganar puntos.' : `Te faltan ${MOON_GOAL - points} puntos para llegar a la Luna.`}
    </Text>
    <Text style={type.caption}>{hint ?? `+${POINTS_SUCCESS} por día completo · −${POINTS_FAIL} por día incompleto`}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(94, 234, 180, 0.22)', padding: space.lg },
  cardArrived: { borderColor: colors.accent, backgroundColor: 'rgba(94, 234, 180, 0.08)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  points: { ...type.caption, fontVariant: ['tabular-nums'] },
  pointsValue: { color: colors.ink, fontSize: 28, fontWeight: '200', letterSpacing: -0.8 },
  route: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.sm },
  earth: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.night },
  trackWrap: { flex: 1, height: 40, justifyContent: 'center', marginHorizontal: space.xs },
  star: { position: 'absolute', borderRadius: 2, backgroundColor: '#DDE8F7', opacity: 0.4 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(160, 190, 230, 0.14)', overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: 3, backgroundColor: colors.accent, transformOrigin: 'left center' },
  rocket: { position: 'absolute', left: 0, top: 7, width: 26, height: 26, marginLeft: -13 },
  rocketBody: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  // El icono "rocket-launch" apunta en diagonal hacia arriba a la derecha: se gira 45° para que avance hacia la Luna (a la derecha).
  rocketIcon: { transform: [{ rotate: '45deg' }] },
  moon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.night },
  moonArrived: { backgroundColor: colors.accent, borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 40, marginRight: 44, marginTop: 2 },
  tick: { ...type.caption, fontSize: 11 },
  message: { color: colors.ink, fontSize: 14, fontWeight: '500', marginTop: space.md, marginBottom: 4 },
});
