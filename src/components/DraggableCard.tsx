import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

type Props = {
  children: React.ReactNode;
  /** Mantener pulsado este tiempo antes de poder arrastrar, para no confundirlo con el desplazamiento. */
  holdMs?: number;
  onDragStart: () => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDrop: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  /** Desplazamiento actual de la página: si la página se mueve mientras se arrastra, la tarjeta lo compensa para seguir bajo el dedo. */
  scrollOffset?: () => number;
};

/**
 * Tarjeta que se arrastra tras una pulsación larga: se levanta, sigue al dedo y al soltar vuelve a su sitio
 * (el contenedor decide si hay que moverla de grupo). Los toques cortos siguen llegando a los botones de dentro.
 */
export default function DraggableCard({ children, holdMs = 350, onDragStart, onDragMove, onDrop, onDragEnd, scrollOffset }: Props) {
  const translate = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);
  const finger = useRef({ x: 0, y: 0 });
  const startOffset = useRef(0);
  const place = () => translate.setValue({ x: finger.current.x, y: finger.current.y + ((scrollOffset?.() ?? 0) - startOffset.current) });

  // Mientras la página se desplaza sola (arrastre cerca del borde) el dedo no se mueve: se recoloca la tarjeta a cada fotograma.
  useEffect(() => {
    if (!dragging || !scrollOffset) return;
    const timer = setInterval(place, 16);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const pan = usePanGesture({
    activateAfterLongPress: holdMs,
    runOnJS: true,
    onActivate: () => { startOffset.current = scrollOffset?.() ?? 0; finger.current = { x: 0, y: 0 }; setDragging(true); onDragStart(); },
    onUpdate: event => { finger.current = { x: event.translationX, y: event.translationY }; place(); onDragMove(event.absoluteX, event.absoluteY); },
    onDeactivate: event => { onDrop(event.absoluteX, event.absoluteY); },
    onFinalize: () => {
      setDragging(false);
      onDragEnd();
      Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
    },
  });

  return <GestureDetector gesture={pan}>
    <Animated.View style={[dragging && styles.lifted, dragging && { transform: [{ translateX: translate.x }, { translateY: translate.y }, { scale: 1.03 }] }]}>
      {children}
    </Animated.View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  lifted: { zIndex: 100, elevation: 16, opacity: 0.96, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
});
