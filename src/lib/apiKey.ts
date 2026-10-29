import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Clave personal de Gemini de cada usuario. Se guarda solo en el teléfono, cifrada por el almacén seguro de Android
 * (Keystore), y nunca se envía a Supabase. Va ligada al usuario para que dos cuentas en el mismo teléfono no la compartan.
 * En web (solo desarrollo) no hay almacén seguro: se usa el almacenamiento del navegador.
 */
const storageKey = (userId: string) => `gemini_api_key_${userId}`;

export async function getApiKey(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey(userId));
    return await SecureStore.getItemAsync(storageKey(userId));
  } catch { return null; }
}

export async function saveApiKey(userId: string, key: string) {
  if (Platform.OS === 'web') { window.localStorage.setItem(storageKey(userId), key); return; }
  await SecureStore.setItemAsync(storageKey(userId), key);
}

export async function deleteApiKey(userId: string) {
  if (Platform.OS === 'web') { window.localStorage.removeItem(storageKey(userId)); return; }
  await SecureStore.deleteItemAsync(storageKey(userId));
}

/** Validación mínima de formato: no garantiza que la clave funcione, solo evita pegar texto que no es una clave. */
export function keyFormatError(value: string) {
  const key = value.trim();
  if (key.length < 20 || /\s/.test(key)) return 'Eso no parece una clave de API. Cópiala completa desde Google AI Studio.';
  return '';
}
