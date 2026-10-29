import React from 'react';
import AuthedScreen from '../src/components/AuthedScreen';
import HabitStatsScreen from '../src/screens/HabitStatsScreen';

/** Subruta /habitos-estadisticas: días exitosos, rachas e historial de hábitos. */
export default function HabitStatsRoute() {
  return <AuthedScreen>{(userId, goBack) => <HabitStatsScreen userId={userId} onBack={goBack} />}</AuthedScreen>;
}
