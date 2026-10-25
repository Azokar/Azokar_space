import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

export async function registerWithEmail(email: string, password: string, firstName: string, lastName: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), display_name: `${firstName.trim()} ${lastName.trim()}` } },
  });
  if (error) throw error;
  return data;
}

export type UserProfile = { id: string; first_name: string; last_name: string; avatar_url: string | null };

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'avatar_url'>) {
  const firstName = profile.first_name.trim();
  const lastName = profile.last_name.trim();
  const { data, error } = await supabase.from('profiles').upsert({
    id: profile.id,
    first_name: firstName,
    last_name: lastName,
    display_name: `${firstName} ${lastName}`,
    avatar_url: profile.avatar_url?.trim() || null,
  }).select('id, first_name, last_name, avatar_url').single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, base64: string, mimeType: string) {
  const normalizedMimeType = mimeType || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(normalizedMimeType)) {
    throw new Error('Formato no compatible. Usa una imagen JPG, PNG o WebP.');
  }
  const extension = normalizedMimeType === 'image/png' ? 'png' : normalizedMimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, decode(base64), {
    contentType: normalizedMimeType,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
