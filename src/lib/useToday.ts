import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toDateString } from './fixedExpenses';

/**
 * Fecha de hoy (AAAA-MM-DD) que se actualiza sola al pasar la medianoche, también si la app estaba abierta
 * o en segundo plano. Los hábitos de "hoy" salen de esta fecha, así que se reinician a las 00:00.
 */
export function useToday() {
  const [today, setToday] = useState(() => toDateString(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toDateString(new Date()));
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return today;
}
