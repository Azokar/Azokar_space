import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AuthedScreen from '../src/components/AuthedScreen';
import ExerciseDetailScreen from '../src/screens/ExerciseDetailScreen';

/** Subruta /ejercicio?id=...: historial y evolución de un ejercicio. */
export default function ExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AuthedScreen>{(userId, goBack) => <ExerciseDetailScreen userId={userId} exerciseId={String(id)} onBack={goBack} />}</AuthedScreen>;
}
