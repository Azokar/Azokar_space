import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@supabase/supabase-js';
import { getProfile, registerWithEmail, signInWithEmail, signOut, updateProfile, uploadAvatar, type UserProfile } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import DashboardScreen from '../src/screens/DashboardScreen';
import FinanceScreen from '../src/screens/FinanceScreen';
import HabitsScreen from '../src/screens/HabitsScreen';
import TasksScreen from '../src/screens/TasksScreen';
import MoonMark from '../src/components/MoonMark';
import { Button, Field, Icon, Starfield, type IconName } from '../src/components/ui';
import { colors, radius, space, type } from '../src/theme';

type TabName = 'Inicio' | 'Finanzas' | 'Hábitos' | 'Tareas';
const TABS: { name: TabName; icon: IconName }[] = [
  { name: 'Inicio', icon: 'home' }, { name: 'Finanzas', icon: 'pie-chart' }, { name: 'Hábitos', icon: 'repeat' }, { name: 'Tareas', icon: 'check-square' },
];

function readableProfileError(error: unknown) {
  const record = error && typeof error === 'object' ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } : null;
  const message = [record?.message, record?.details, record?.hint].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
  if (/column .* does not exist|could not find .*column|schema cache/i.test(message)) {
    return 'Faltan columnas en Supabase. Ejecuta supabase/migrations/20261022_profile_fields.sql en SQL Editor y vuelve a intentar.';
  }
  if (message) return `No se pudo guardar: ${message}${record?.code ? ` (${String(record.code)})` : ''}`;
  return error instanceof Error ? `No se pudo guardar: ${error.message}` : `No se pudo guardar: ${JSON.stringify(error)}`;
}

export default function HomeScreen() {
  const [tab, setTab] = useState<TabName>('Inicio');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) { setProfile(null); return; }
    let active = true;
    getProfile(userId).then((nextProfile) => { if (active) setProfile(nextProfile); }).catch((error) => {
      if (active) setToast({ message: readableProfileError(error), tone: 'error' });
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  if (loading) return <SafeAreaView style={s.safe}><Starfield /><View style={s.loading}><MoonMark size={56} /><ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} /></View></SafeAreaView>;
  if (!session) return <AuthScreen />;

  const firstName = profile?.first_name || 'Explorador';
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <Starfield />
      <KeyboardAvoidingView style={s.authFlex} behavior="padding">
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.headerCopy}>
            <View style={s.brandRow}><MoonMark size={20} /><Text style={type.overline}>AZOKAR · SPACE</Text></View>
            <Text style={s.title} numberOfLines={1}>{tab === 'Inicio' ? `Hola, ${firstName}` : tab}</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => setProfileOpen(true)} accessibilityLabel="Abrir perfil">
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImage} /> : <Text style={s.avatarText}>{(profile?.first_name?.[0] ?? session.user.email?.[0] ?? 'A').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>

        {tab === 'Inicio' && <DashboardScreen userId={session.user.id} onNavigate={next => setTab(next as TabName)} />}
        {tab === 'Finanzas' && <FinanceScreen userId={session.user.id} />}
        {tab === 'Hábitos' && <HabitsScreen userId={session.user.id} />}
        {tab === 'Tareas' && <TasksScreen userId={session.user.id} />}
        <View style={s.bottomSpace} />
      </ScrollView>
      {!keyboardOpen && <View style={s.nav}>
        {TABS.map(({ name, icon }) => {
          const active = tab === name;
          return <TouchableOpacity key={name} activeOpacity={0.7} style={s.navItem} onPress={() => setTab(name)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Icon name={icon} size={20} color={active ? colors.accent : colors.muted} />
            <Text style={[s.navLabel, active && s.navLabelActive]}>{name}</Text>
            <View style={[s.navDot, active && s.navDotActive]} />
          </TouchableOpacity>;
        })}
      </View>}
      </KeyboardAvoidingView>
      <ProfileModal visible={profileOpen} profile={profile} userId={session.user.id} email={session.user.email ?? ''} onClose={() => setProfileOpen(false)} onSaved={(nextProfile) => { setProfile(nextProfile); setProfileOpen(false); setToast({ message: 'Cambios guardados con éxito', tone: 'success' }); }} />
      {toast && <View pointerEvents="none" style={[s.toast, toast.tone === 'error' && s.toastError]}><Icon name={toast.tone === 'success' ? 'check-circle' : 'alert-triangle'} size={16} color={toast.tone === 'success' ? colors.accent : colors.danger} /><Text style={s.toastText}>{toast.message}</Text></View>}
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password || (mode === 'signup' && (!firstName.trim() || !lastName.trim()))) return Alert.alert('Faltan datos', mode === 'signup' ? 'Completa nombre, apellido, correo y contraseña.' : 'Escribe tu correo y contraseña.');
    setBusy(true);
    try {
      if (mode === 'signup') await registerWithEmail(email, password, firstName, lastName);
      else await signInWithEmail(email, password);
    } catch (error) {
      Alert.alert(mode === 'signup' ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <Starfield />
      <KeyboardAvoidingView style={s.authFlex} behavior="padding">
        <ScrollView contentContainerStyle={s.authScreen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.authMark}><MoonMark size={72} /></View>
          <Text style={s.brandName}>AZOKAR SPACE</Text>
          <Text style={s.authTitle}>{mode === 'signup' ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</Text>
          <Text style={s.authSubtitle}>Tus finanzas, hábitos y semana en un solo lugar.</Text>
          {mode === 'signup' && <>
            <Field label="NOMBRE" value={firstName} onChangeText={setFirstName} placeholder="Tu nombre" autoCapitalize="words" autoCorrect={false} />
            <Field label="APELLIDO" value={lastName} onChangeText={setLastName} placeholder="Tu apellido" autoCapitalize="words" autoCorrect={false} />
          </>}
          <Field label="CORREO ELECTRÓNICO" value={email} onChangeText={setEmail} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
          <Field label="CONTRASEÑA" value={password} onChangeText={setPassword} placeholder="Tu contraseña" secureTextEntry textContentType={mode === 'signup' ? 'newPassword' : 'password'} />
          <Button label={mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'} onPress={submit} busy={busy} style={{ marginTop: space.xl }} />
          <TouchableOpacity style={s.authSwitch} onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
            <Text style={s.authSwitchText}>{mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿Primera vez aquí? '}<Text style={s.authSwitchStrong}>{mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileModal({ visible, profile, userId, email, onClose, onSaved }: { visible: boolean; profile: UserProfile | null; userId: string; email: string; onClose: () => void; onSaved: (profile: UserProfile) => void }) {
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => { setFirstName(profile?.first_name ?? ''); setLastName(profile?.last_name ?? ''); setPickedImage(null); }, [profile, visible]);
  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.base64) return Alert.alert('No se pudo leer la imagen', 'Elige otra imagen e inténtalo de nuevo.');
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return Alert.alert('Imagen muy grande', 'Elige una imagen de menos de 5 MB.');
        setPickedImage({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
      }
    } catch (error) { Alert.alert('No se pudo abrir la galería', error instanceof Error ? error.message : 'Inténtalo de nuevo.'); }
  };
  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) return Alert.alert('Faltan datos', 'El nombre y apellido son obligatorios.');
    setBusy(true);
    setFeedback('');
    try {
      const finalAvatarUrl = pickedImage ? await uploadAvatar(userId, pickedImage.base64, pickedImage.mimeType) : profile?.avatar_url ?? null;
      const saved = await updateProfile({ id: userId, first_name: firstName, last_name: lastName, avatar_url: finalAvatarUrl });
      onSaved(saved);
    }
    catch (error) { setFeedback(readableProfileError(error)); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.authFlex} behavior="padding"><View style={s.modalBackdrop}><ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled"><View style={s.profileSheet}>
      <View style={s.grabber} />
      <View style={s.profileHeading}>
        <View style={{ flex: 1 }}><Text style={type.title}>Mi perfil</Text><Text style={[type.caption, { marginTop: 4 }]}>{email}</Text></View>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar"><Icon name="x" size={22} color={colors.muted} /></TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={0.8} onPress={choosePhoto} disabled={busy} style={s.profileAvatar} accessibilityLabel="Elegir foto del dispositivo">
        {pickedImage || profile?.avatar_url ? <Image source={{ uri: pickedImage?.uri ?? profile?.avatar_url ?? '' }} style={s.profileImage} /> : <Text style={s.profileAvatarText}>{(firstName[0] ?? 'A').toUpperCase()}</Text>}
        <View style={s.cameraBadge}><Icon name="camera" size={13} color={colors.onAccent} /></View>
      </TouchableOpacity>
      <Text style={s.photoHint}>Toca para elegir una foto</Text>
      <Field label="NOMBRE" value={firstName} onChangeText={setFirstName} placeholder="Tu nombre" autoCapitalize="words" />
      <Field label="APELLIDO" value={lastName} onChangeText={setLastName} placeholder="Tu apellido" autoCapitalize="words" />
      {!!feedback && <Text style={s.formError}>{feedback}</Text>}
      <Button label="Guardar cambios" onPress={save} busy={busy} />
      <Button label="Cerrar sesión" variant="danger" icon="log-out" onPress={() => signOut().catch(error => Alert.alert('No se pudo cerrar sesión', error.message))} style={{ marginTop: space.md }} />
    </View></ScrollView></View></KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.void },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { paddingHorizontal: 20, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xl },
  headerCopy: { flex: 1, paddingRight: space.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.title, marginTop: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarText: { color: colors.accent, fontSize: 17, fontWeight: '500' },
  bottomSpace: { height: 28 },
  nav: { flexDirection: 'row', backgroundColor: 'rgba(7, 11, 19, 0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10, paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: '500', letterSpacing: 0.3 },
  navLabelActive: { color: colors.accent },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  navDotActive: { backgroundColor: colors.accent },
  authFlex: { flex: 1 },
  authScreen: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: space.xxl },
  authMark: { marginBottom: space.lg },
  brandName: { color: colors.accent, fontSize: 11, fontWeight: '600', letterSpacing: 4, marginBottom: space.md },
  authTitle: { ...type.display, fontSize: 34 },
  authSubtitle: { ...type.body, color: colors.muted, lineHeight: 21, marginTop: space.sm, marginBottom: space.md },
  authSwitch: { alignItems: 'center', paddingVertical: space.xl },
  authSwitchText: { color: colors.muted, fontSize: 13 },
  authSwitchStrong: { color: colors.accent, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: colors.night, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, paddingHorizontal: 22, paddingTop: space.md, paddingBottom: 32 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: space.lg },
  profileHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong, alignSelf: 'center', marginTop: space.xl, justifyContent: 'center', alignItems: 'center' },
  profileImage: { width: 88, height: 88, borderRadius: 44 },
  profileAvatarText: { color: colors.accent, fontSize: 32, fontWeight: '300' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.night },
  photoHint: { ...type.caption, textAlign: 'center', marginTop: space.md },
  formError: { color: colors.danger, fontSize: 12, marginTop: space.md, lineHeight: 18 },
  toast: { position: 'absolute', bottom: 88, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong, paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.pill, maxWidth: '90%', elevation: 8 },
  toastError: { borderColor: 'rgba(255, 138, 155, 0.4)' },
  toastText: { color: colors.ink, fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
