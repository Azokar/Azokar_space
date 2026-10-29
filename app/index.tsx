import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown, FadeInLeft, FadeInRight, FadeOutDown, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@supabase/supabase-js';
import { getProfile, registerWithEmail, signInWithEmail, signOut, updateProfile, uploadAvatar, type UserProfile } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import DashboardScreen from '../src/screens/DashboardScreen';
import FinanceScreen from '../src/screens/FinanceScreen';
import HabitsScreen from '../src/screens/HabitsScreen';
import TasksScreen from '../src/screens/TasksScreen';
import ExerciseScreen from '../src/screens/ExerciseScreen';
import MoonMark from '../src/components/MoonMark';
import QuickEntry from '../src/components/QuickEntry';
import { deleteApiKey, getApiKey, keyFormatError, saveApiKey } from '../src/lib/apiKey';
import { Button, Field, Icon, Starfield, type IconName } from '../src/components/ui';
import { colors, radius, space, type } from '../src/theme';
import { AutoScrollContext, ScrollLockContext, type AutoScroll } from '../src/lib/scrollLock';
import { MOTION_BASE, MOTION_EXIT, SPRING_SOFT } from '../src/lib/motion';

type TabName = 'Inicio' | 'Finanzas' | 'Hábitos' | 'Tareas' | 'Ejercicio';
const TABS: { name: TabName; icon: IconName }[] = [
  { name: 'Inicio', icon: 'home' }, { name: 'Finanzas', icon: 'pie-chart' }, { name: 'Hábitos', icon: 'repeat' }, { name: 'Tareas', icon: 'check-square' }, { name: 'Ejercicio', icon: 'activity' },
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
  const [refreshKey, setRefreshKey] = useState(0); // al cambiar, las pantallas se vuelven a montar y recargan sus datos
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const tabIndex = TABS.findIndex(item => item.name === tab);
  // Dirección de la transición: hacia delante entra desde la derecha, hacia atrás desde la izquierda.
  const previousIndex = useRef(tabIndex);
  const forward = tabIndex >= previousIndex.current;
  useEffect(() => { previousIndex.current = tabIndex; }, [tabIndex]);
  // Indicador de la barra inferior: se desliza con un resorte hasta la pestaña activa.
  const [navWidth, setNavWidth] = useState(0);
  const itemWidth = navWidth / TABS.length;
  const indicatorX = useSharedValue(0);
  useEffect(() => {
    if (itemWidth === 0) return;
    indicatorX.value = reduceMotion ? tabIndex * itemWidth : withSpring(tabIndex * itemWidth, SPRING_SOFT);
  }, [tabIndex, itemWidth, reduceMotion, indicatorX]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));
  const [scrollLocked, setScrollLocked] = useState(false); // se activa mientras se arrastra un elemento
  // Desplazamiento automático al arrastrar cerca del borde: se guarda posición y tamaños para no pasarse del contenido.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollMetrics = useRef({ offset: 0, content: 0, viewport: 0 });
  const autoScroll = useMemo<AutoScroll>(() => ({
    by: dy => {
      const metrics = scrollMetrics.current;
      const next = Math.min(Math.max(0, metrics.offset + dy), Math.max(0, metrics.content - metrics.viewport));
      if (next === metrics.offset) return;
      metrics.offset = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
    },
    offset: () => scrollMetrics.current.offset,
  }), []);

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

  if (loading) return <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}><Starfield /><View style={s.loading}><MoonMark size={56} /><ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} /></View></SafeAreaView>;
  if (!session) return <AuthScreen />;

  const firstName = profile?.first_name || 'Explorador';
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <Starfield />
      <KeyboardAvoidingView style={s.authFlex} behavior="padding">
      <ScrollView ref={scrollRef} contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={!scrollLocked} scrollEventThrottle={16} onScroll={event => { scrollMetrics.current.offset = event.nativeEvent.contentOffset.y; }} onContentSizeChange={(_width, height) => { scrollMetrics.current.content = height; }} onLayout={event => { scrollMetrics.current.viewport = event.nativeEvent.layout.height; }}>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <View style={s.brandRow}><MoonMark size={20} /><Text style={type.overline}>AZOKAR · SPACE</Text></View>
            <Text style={s.title} numberOfLines={1}>{tab === 'Inicio' ? `Hola, ${firstName}` : tab}</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => setProfileOpen(true)} accessibilityLabel="Abrir perfil">
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImage} /> : <Text style={s.avatarText}>{(profile?.first_name?.[0] ?? session.user.email?.[0] ?? 'A').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>

        <Reanimated.View key={tab} entering={(forward ? FadeInRight : FadeInLeft).duration(MOTION_BASE).withInitialValues({ opacity: 0, transform: [{ translateX: forward ? 22 : -22 }] }).reduceMotion(ReduceMotion.System)}>
          <React.Fragment key={refreshKey}>
          {tab === 'Inicio' && <DashboardScreen userId={session.user.id} onNavigate={next => setTab(next as TabName)} />}
          {tab === 'Finanzas' && <FinanceScreen userId={session.user.id} />}
          {tab === 'Hábitos' && <HabitsScreen userId={session.user.id} />}
          {tab === 'Tareas' && <TasksScreen userId={session.user.id} />}
          {tab === 'Ejercicio' && <ScrollLockContext.Provider value={setScrollLocked}><AutoScrollContext.Provider value={autoScroll}><ExerciseScreen userId={session.user.id} /></AutoScrollContext.Provider></ScrollLockContext.Provider>}
          </React.Fragment>
        </Reanimated.View>
        <View style={s.bottomSpace} />
      </ScrollView>
      {!keyboardOpen && <View style={[s.nav, { paddingBottom: 8 + insets.bottom }]} onLayout={event => setNavWidth(event.nativeEvent.layout.width)} accessibilityRole="tablist">
        {itemWidth > 0 && <Reanimated.View style={[s.navIndicatorWrap, { width: itemWidth }, indicatorStyle]} pointerEvents="none"><View style={s.navIndicator} /></Reanimated.View>}
        {TABS.map(({ name, icon }) => {
          const active = tab === name;
          return <Pressable key={name} android_ripple={{ color: 'rgba(94, 234, 180, 0.12)', borderless: false }} style={({ pressed }) => [s.navItem, pressed && { opacity: 0.7 }]} onPress={() => setTab(name)} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected: active }}>
            <Icon name={icon} size={20} color={active ? colors.accent : colors.muted} />
            <Text style={[s.navLabel, active && s.navLabelActive]}>{name}</Text>
          </Pressable>;
        })}
      </View>}
      <QuickEntry userId={session.user.id} bottom={84 + insets.bottom} hideButton={keyboardOpen || scrollLocked} onSaved={() => setRefreshKey(value => value + 1)} onOpenProfile={() => setProfileOpen(true)} />
      </KeyboardAvoidingView>
      <ProfileModal visible={profileOpen} profile={profile} userId={session.user.id} email={session.user.email ?? ''} onClose={() => setProfileOpen(false)} onSaved={(nextProfile) => { setProfile(nextProfile); setProfileOpen(false); setToast({ message: 'Cambios guardados con éxito', tone: 'success' }); }} />
      {toast && <Reanimated.View entering={FadeInDown.duration(MOTION_BASE).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(MOTION_EXIT).reduceMotion(ReduceMotion.System)} pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.toast, { bottom: 84 + insets.bottom }, toast.tone === 'error' && s.toastError]}><Icon name={toast.tone === 'success' ? 'check-circle' : 'alert-triangle'} size={16} color={toast.tone === 'success' ? colors.accent : colors.danger} /><Text style={s.toastText}>{toast.message}</Text></Reanimated.View>}
    </SafeAreaView>
  );
}

type AuthErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'form', string>>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Traduce los errores de Supabase a un mensaje que dice qué pasó y cómo seguir. */
function friendlyAuthError(error: unknown, mode: 'signin' | 'signup') {
  const message = error instanceof Error ? error.message : '';
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no coinciden. Revisa los datos e inténtalo de nuevo.';
  if (/already registered|already been registered/i.test(message)) return 'Ese correo ya tiene una cuenta. Prueba a iniciar sesión.';
  if (/password should be at least|weak/i.test(message)) return 'La contraseña es demasiado corta. Usa al menos 6 caracteres.';
  if (/network|fetch|failed to/i.test(message)) return 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.';
  return message || (mode === 'signup' ? 'No se pudo crear la cuenta. Inténtalo de nuevo.' : 'No se pudo iniciar sesión. Inténtalo de nuevo.');
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [busy, setBusy] = useState(false);

  const emailError = (value: string) => (!value.trim() ? 'Escribe tu correo electrónico.' : !EMAIL_PATTERN.test(value.trim()) ? 'Revisa el correo: debe tener el formato nombre@dominio.com.' : undefined);
  const passwordError = (value: string) => (!value ? 'Escribe tu contraseña.' : mode === 'signup' && value.length < 6 ? 'Usa al menos 6 caracteres.' : undefined);
  const setError = (key: keyof AuthErrors, message?: string) => setErrors(current => ({ ...current, [key]: message, form: key === 'form' ? message : undefined }));

  const submit = async () => {
    const next: AuthErrors = {
      firstName: mode === 'signup' && !firstName.trim() ? 'Escribe tu nombre.' : undefined,
      lastName: mode === 'signup' && !lastName.trim() ? 'Escribe tu apellido.' : undefined,
      email: emailError(email),
      password: passwordError(password),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      if (mode === 'signup') await registerWithEmail(email, password, firstName, lastName);
      else await signInWithEmail(email, password);
    } catch (error) {
      setErrors({ form: friendlyAuthError(error, mode) });
    } finally { setBusy(false); }
  };
  const switchMode = () => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErrors({}); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <Starfield />
      <KeyboardAvoidingView style={s.authFlex} behavior="padding">
        <ScrollView contentContainerStyle={s.authScreen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Reanimated.View entering={FadeInDown.duration(MOTION_BASE + 120).reduceMotion(ReduceMotion.System)}>
            <View style={s.authMark}><MoonMark size={72} /></View>
            <Text style={s.brandName}>AZOKAR SPACE</Text>
            <Text style={s.authTitle} accessibilityRole="header">{mode === 'signup' ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</Text>
            <Text style={s.authSubtitle}>Tus finanzas, hábitos y semana en un solo lugar.</Text>
          </Reanimated.View>
          {mode === 'signup' && <>
            <Field label="NOMBRE" value={firstName} onChangeText={value => { setFirstName(value); if (errors.firstName) setError('firstName'); }} error={errors.firstName} placeholder="Tu nombre" autoCapitalize="words" autoCorrect={false} textContentType="givenName" />
            <Field label="APELLIDO" value={lastName} onChangeText={value => { setLastName(value); if (errors.lastName) setError('lastName'); }} error={errors.lastName} placeholder="Tu apellido" autoCapitalize="words" autoCorrect={false} textContentType="familyName" />
          </>}
          <Field label="CORREO ELECTRÓNICO" value={email} onChangeText={value => { setEmail(value); if (errors.email) setError('email'); }} onBlur={() => { if (email) setError('email', emailError(email)); }} error={errors.email} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" />
          <Field
            label="CONTRASEÑA"
            value={password}
            onChangeText={value => { setPassword(value); if (errors.password) setError('password'); }}
            onBlur={() => { if (password && mode === 'signup') setError('password', passwordError(password)); }}
            error={errors.password}
            helper={mode === 'signup' && !errors.password ? 'Mínimo 6 caracteres.' : undefined}
            placeholder="Tu contraseña"
            secureTextEntry={!showPassword}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            trailing={<Pressable onPress={() => setShowPassword(value => !value)} hitSlop={6} style={s.passwordToggle} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}><Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.inkSoft} /></Pressable>}
          />
          {!!errors.form && <View style={s.formAlert} accessibilityRole="alert" accessibilityLiveRegion="polite"><Icon name="alert-circle" size={16} color={colors.danger} /><Text style={s.formAlertText}>{errors.form}</Text></View>}
          <Button label={mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'} onPress={submit} busy={busy} style={{ marginTop: space.xl }} />
          <Pressable style={s.authSwitch} onPress={switchMode} accessibilityRole="button" accessibilityLabel={mode === 'signup' ? 'Ir a iniciar sesión' : 'Ir a crear una cuenta'}>
            <Text style={s.authSwitchText}>{mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿Primera vez aquí? '}<Text style={s.authSwitchStrong}>{mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</Text></Text>
          </Pressable>
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
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  // Clave de Gemini: vive solo en el teléfono. Una vez guardada nunca se vuelve a mostrar, solo se puede reemplazar o borrar.
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [replacingKey, setReplacingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keyNotice, setKeyNotice] = useState('');
  useEffect(() => { setFirstName(profile?.first_name ?? ''); setLastName(profile?.last_name ?? ''); setPickedImage(null); setFeedback(''); setErrors({}); }, [profile, visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setKeyInput(''); setShowKey(false); setReplacingKey(false); setKeyError(''); setKeyNotice('');
    getApiKey(userId).then(key => { if (active) setHasKey(!!key); });
    return () => { active = false; };
  }, [visible, userId]);
  const saveKey = async () => {
    const problem = keyFormatError(keyInput);
    if (problem) return setKeyError(problem);
    try { await saveApiKey(userId, keyInput.trim()); setHasKey(true); setKeyInput(''); setShowKey(false); setReplacingKey(false); setKeyError(''); setKeyNotice('Clave guardada en este teléfono.'); }
    catch { setKeyError('No se pudo guardar la clave en el almacén seguro del teléfono.'); }
  };
  const removeKey = async () => {
    try { await deleteApiKey(userId); setHasKey(false); setReplacingKey(false); setKeyError(''); setKeyNotice('Clave eliminada de este teléfono.'); }
    catch { setKeyError('No se pudo eliminar la clave.'); }
  };
  const choosePhoto = async () => {
    setFeedback('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.base64) return setFeedback('No se pudo leer la imagen. Elige otra e inténtalo de nuevo.');
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return setFeedback('La imagen pesa más de 5 MB. Elige una más ligera.');
        setPickedImage({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
      }
    } catch (error) { setFeedback(`No se pudo abrir la galería: ${error instanceof Error ? error.message : 'inténtalo de nuevo.'}`); }
  };
  const save = async () => {
    const next = { firstName: firstName.trim() ? undefined : 'Escribe tu nombre.', lastName: lastName.trim() ? undefined : 'Escribe tu apellido.' };
    setErrors(next);
    if (next.firstName || next.lastName) return;
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
        <View style={{ flex: 1 }}><Text style={type.title} accessibilityRole="header">Mi perfil</Text><Text style={[type.caption, { marginTop: 4 }]}>{email}</Text></View>
        <Pressable onPress={onClose} hitSlop={8} style={s.closeButton} accessibilityRole="button" accessibilityLabel="Cerrar"><Icon name="x" size={22} color={colors.muted} /></Pressable>
      </View>
      <Pressable onPress={choosePhoto} disabled={busy} style={({ pressed }) => [s.profileAvatar, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Elegir foto del dispositivo">
        {pickedImage || profile?.avatar_url ? <Image source={{ uri: pickedImage?.uri ?? profile?.avatar_url ?? '' }} style={s.profileImage} /> : <Text style={s.profileAvatarText}>{(firstName[0] ?? 'A').toUpperCase()}</Text>}
        <View style={s.cameraBadge}><Icon name="camera" size={13} color={colors.onAccent} /></View>
      </Pressable>
      <Text style={s.photoHint}>Toca para elegir una foto</Text>
      <Field label="NOMBRE" value={firstName} onChangeText={value => { setFirstName(value); if (errors.firstName) setErrors(current => ({ ...current, firstName: undefined })); }} error={errors.firstName} placeholder="Tu nombre" autoCapitalize="words" />
      <Field label="APELLIDO" value={lastName} onChangeText={value => { setLastName(value); if (errors.lastName) setErrors(current => ({ ...current, lastName: undefined })); }} error={errors.lastName} placeholder="Tu apellido" autoCapitalize="words" />
      {!!feedback && <Text style={s.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">{feedback}</Text>}
      <Button label="Guardar cambios" onPress={save} busy={busy} />

      <View style={s.keySection}>
        <Text style={type.overline}>REGISTRO RÁPIDO · GEMINI</Text>
        <Text style={[type.caption, { marginTop: 6 }]}>Tu clave gratuita de Google AI Studio permite registrar escribiendo. Se guarda cifrada solo en este teléfono, no se sube a ningún servidor nuestro y no se vuelve a mostrar. Lo que escribas se envía a Google para interpretarlo.</Text>
        {hasKey && !replacingKey ? <>
          <View style={s.keySaved}><Icon name="lock" size={15} color={colors.accent} /><Text style={s.keySavedText}>Clave guardada  ••••••••••••</Text></View>
          <View style={s.keyActions}>
            <View style={{ flex: 1 }}><Button label="Reemplazar" variant="ghost" onPress={() => { setReplacingKey(true); setKeyNotice(''); }} /></View>
            <View style={{ flex: 1 }}><Button label="Eliminar" variant="danger" onPress={removeKey} /></View>
          </View>
        </> : <>
          <Field
            value={keyInput}
            onChangeText={value => { setKeyInput(value); if (keyError) setKeyError(''); }}
            placeholder="Pega tu clave de Gemini"
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            error={keyError || undefined}
            helper={keyError ? undefined : 'Consíguela gratis en aistudio.google.com/apikey'}
            trailing={<Pressable onPress={() => setShowKey(value => !value)} hitSlop={6} style={s.passwordToggle} accessibilityRole="button" accessibilityLabel={showKey ? 'Ocultar clave' : 'Mostrar clave'}><Icon name={showKey ? 'eye-off' : 'eye'} size={18} color={colors.inkSoft} /></Pressable>}
          />
          <Button label="Guardar clave" variant="ghost" icon="key" onPress={saveKey} />
          {replacingKey && <Button label="Cancelar" variant="ghost" onPress={() => { setReplacingKey(false); setKeyInput(''); setKeyError(''); }} style={{ marginTop: space.sm }} />}
        </>}
        {!!keyNotice && <Text style={s.keyNotice} accessibilityLiveRegion="polite">{keyNotice}</Text>}
        {hasKey && !replacingKey && !!keyError && <Text style={s.formError} accessibilityRole="alert">{keyError}</Text>}
      </View>
      <Button label="Cerrar sesión" variant="danger" icon="log-out" onPress={() => signOut().catch(error => setFeedback(`No se pudo cerrar sesión: ${error.message}`))} style={{ marginTop: space.md }} />
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
  nav: { flexDirection: 'row', backgroundColor: 'rgba(7, 11, 19, 0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 6, paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48, justifyContent: 'center' },
  navIndicatorWrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  navIndicator: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  navLabel: { color: colors.muted, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  navLabelActive: { color: colors.accent },
  authFlex: { flex: 1 },
  authScreen: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: space.xxl },
  authMark: { marginBottom: space.lg },
  brandName: { color: colors.accent, fontSize: 12, fontWeight: '600', letterSpacing: 4, marginBottom: space.md },
  authTitle: { ...type.display, fontSize: 34 },
  authSubtitle: { ...type.body, color: colors.muted, lineHeight: 21, marginTop: space.sm, marginBottom: space.md },
  passwordToggle: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255, 138, 155, 0.4)', backgroundColor: colors.dangerSoft },
  formAlertText: { color: colors.danger, fontSize: 13, lineHeight: 18, flex: 1 },
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
  keySection: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  keySaved: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.accentGlow },
  keySavedText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  keyActions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  keyNotice: { color: colors.accent, fontSize: 13, marginTop: space.md },
  toast: { position: 'absolute', bottom: 88, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong, paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.pill, maxWidth: '90%', elevation: 8 },
  toastError: { borderColor: 'rgba(255, 138, 155, 0.4)' },
  toastText: { color: colors.ink, fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
