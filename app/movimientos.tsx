import React from 'react';
import AuthedScreen from '../src/components/AuthedScreen';
import MovementsScreen from '../src/screens/MovementsScreen';

/** Subruta /movimientos: historial completo de ingresos y gastos. */
export default function MovementsRoute() {
  return <AuthedScreen>{(userId, goBack) => <MovementsScreen userId={userId} onBack={goBack} />}</AuthedScreen>;
}
