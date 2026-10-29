import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { MOTION_DURATION, easeOutExpo } from '../lib/motion';

type Props = {
  value: number;
  /** Cómo se escribe el número (por ejemplo, dinero con puntos de miles). Por defecto, el número tal cual. */
  format?: (value: number) => string;
  duration?: number;
  /** Si es true, al aparecer cuenta desde 0 hasta el valor. */
  countOnMount?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * Número con efecto de conteo: al cambiar `value` pasa suavemente del valor que se ve ahora al nuevo,
 * sea mayor o menor, con la misma curva de movimiento que las gráficas.
 *
 * Rendimiento: solo se vuelve a dibujar este texto (no la pantalla), unas 40 veces por transición, y el cálculo
 * es una operación aritmética por fotograma. Se detiene solo al llegar y se cancela si el componente desaparece
 * o si llega otro valor (parte desde lo que se estaba viendo, sin saltos).
 */
export default function AnimatedNumber({ value, format = String, duration = MOTION_DURATION, countOnMount = true, style }: Props) {
  const reduceMotion = useReducedMotion();
  const shown = useRef(reduceMotion || !countOnMount ? value : 0);
  const [display, setDisplay] = useState(shown.current);

  useEffect(() => {
    if (reduceMotion) { shown.current = value; setDisplay(value); return; }
    const from = shown.current;
    if (from === value) return;
    let frame = 0;
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const step = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) { shown.current = value; setDisplay(value); return; }
      const current = from + (value - from) * easeOutExpo(t);
      shown.current = current;
      // Durante el conteo se muestran enteros (o centésimas si la cifra es pequeña) para que no parpadeen decimales.
      setDisplay(Math.abs(value) >= 100 || Math.abs(from) >= 100 ? Math.round(current) : Math.round(current * 100) / 100);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  return <Text style={style}>{format(display)}</Text>;
}
