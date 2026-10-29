import React from 'react';
import AuthedScreen from '../src/components/AuthedScreen';
import StatsScreen from '../src/screens/StatsScreen';

/** Subruta /estadisticas: vista de pantalla completa, fuera del scroll de Finanzas. */
export default function StatsRoute() {
  return <AuthedScreen>{(userId, goBack) => <StatsScreen userId={userId} onBack={goBack} />}</AuthedScreen>;
}
