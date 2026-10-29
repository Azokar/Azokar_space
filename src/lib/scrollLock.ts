import { createContext, useContext } from 'react';

/**
 * Permite que una pantalla bloquee el desplazamiento de la página mientras arrastra un elemento.
 * La pantalla contenedora (app/index.tsx) provee la función; sin proveedor no hace nada.
 */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});
export const useScrollLock = () => useContext(ScrollLockContext);

/**
 * Desplazamiento automático de la página mientras se arrastra cerca del borde de la pantalla.
 * `by` mueve la página `dy` px (limitado a su contenido) y `offset` devuelve el desplazamiento actual.
 */
export type AutoScroll = { by: (dy: number) => void; offset: () => number };
export const AutoScrollContext = createContext<AutoScroll>({ by: () => {}, offset: () => 0 });
export const useAutoScroll = () => useContext(AutoScrollContext);
