import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  // La raíz de gestos es necesaria para arrastrar elementos (por ejemplo, mover un ejercicio de día).
  return <GestureHandlerRootView style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false }} /></GestureHandlerRootView>;
}
