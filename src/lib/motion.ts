import { AccessibilityInfo, LayoutAnimation, Platform } from 'react-native';

/**
 * Sistema de movimiento de la app. Todas las animaciones comparten estas duraciones y curvas para que tengan el
 * mismo ritmo. Regla general: entrar es más lento que salir, solo se animan `transform` y `opacity`, y todo se
 * detiene o se reduce si el usuario activó "reducir movimiento" en el sistema.
 */

/** Cambios de estado inmediatos (pulsar, cambiar de color): se perciben como respuesta, no como animación. */
export const MOTION_FAST = 120;
/** Aparición de elementos y cambios de estado normales. */
export const MOTION_BASE = 240;
/** Transiciones de datos grandes (gráficas, números): cuenta y trazo largos. */
export const MOTION_DURATION = 700;
/** Salir debe ser más corto que entrar (~65%) para que la interfaz se sienta ágil. */
export const MOTION_EXIT = Math.round(MOTION_BASE * 0.65);

/** Resorte para elementos que "rebotan" al soltarse (botones, casillas). */
export const SPRING = { damping: 16, stiffness: 260, mass: 0.7 } as const;
/** Resorte más suave para desplazamientos con distancia (indicador de la barra inferior). */
export const SPRING_SOFT = { damping: 20, stiffness: 190, mass: 0.9 } as const;

/** Escala al pulsar un control: lo bastante visible para confirmar el toque sin deformar el diseño. */
export const PRESS_SCALE = 0.97;
/** Retraso entre elementos consecutivos de una lista; se limita a pocos elementos para no hacer esperar. */
export const STAGGER_MS = 40;
export const STAGGER_MAX_ITEMS = 7;

/** Función de easing cúbica de Bézier (la misma que usa CSS), resuelta con Newton-Raphson. Devuelve y para un x en 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-5) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    // Respaldo por bisección si Newton no converge.
    let low = 0;
    let high = 1;
    t = x;
    while (low < high) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-5) break;
      if (x > value) low = t; else high = t;
      t = (high - low) / 2 + low;
      if (high - low < 1e-6) break;
    }
    return sampleY(t);
  };
}

export const easeOutExpo = cubicBezier(0.16, 1, 0.3, 1);

// ---- Animaciones de diseño (abrir/cerrar secciones) que respetan "reducir movimiento" ----
let reduceMotionEnabled = false;
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  AccessibilityInfo.isReduceMotionEnabled().then(value => { reduceMotionEnabled = value; }).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotionEnabled = value; });
}

/** Anima el próximo cambio de diseño (abrir o cerrar una sección). No hace nada si el usuario pidió reducir el movimiento. */
export function animateLayout() {
  if (reduceMotionEnabled) return;
  LayoutAnimation.configureNext(LayoutAnimation.create(MOTION_BASE, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
