import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { registerWithEmail, signInWithEmail, signOut } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';

const GREEN = '#16A34A';
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const habits = [
  { id: '1', title: 'Leer 20 minutos', done: true, icon: '◫' },
  { id: '2', title: 'Entrenar', done: true, icon: '↗' },
  { id: '3', title: 'Tomar 2L de agua', done: false, icon: '◉' },
];

export default function HomeScreen() {
  const [tab, setTab] = useState('Inicio');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const completed = habits.filter(h => h.done).length;

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

  if (loading) return <SafeAreaView style={s.safe}><View style={s.loading}><ActivityIndicator color={GREEN} size="large" /></View></SafeAreaView>;
  if (!session) return <AuthScreen />;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View><Text style={s.eyebrow}>MIÉRCOLES, 21 DE OCTUBRE</Text><Text style={s.title}>Buen día, Alex <Text style={s.wave}>✳</Text></Text></View>
          <TouchableOpacity style={s.avatar} onPress={() => signOut().catch(error => Alert.alert('No se pudo cerrar sesión', error.message))}><Text style={s.avatarText}>{(session.user.email?.[0] ?? 'A').toUpperCase()}</Text></TouchableOpacity>
        </View>

        <View style={s.balanceCard}>
          <View style={s.cardTop}><Text style={s.cardLabel}>BALANCE DEL MES</Text><Text style={s.trend}>↗ 8.4%</Text></View>
          <Text style={s.balance}>$2,480.50</Text>
          <View style={s.balanceFoot}><Text style={s.balanceSub}>Ingresos <Text style={s.whiteStrong}>$3,200</Text></Text><View style={s.dot} /><Text style={s.balanceSub}>Gastos <Text style={s.whiteStrong}>$719.50</Text></Text></View>
          <View style={s.progressTrack}><View style={s.progressFill} /></View>
        </View>

        <View style={s.sectionHead}><Text style={s.sectionTitle}>Accesos rápidos</Text><Text style={s.muted}>Hoy</Text></View>
        <View style={s.quickRow}>
          <Quick label="Registrar gasto" icon="−" tone="green" />
          <Quick label="Nuevo hábito" icon="✳" tone="black" />
          <Quick label="Añadir tarea" icon="＋" tone="outline" />
        </View>

        <View style={s.sectionHead}><Text style={s.sectionTitle}>Hábitos de hoy</Text><Text style={s.greenText}>{completed}/{habits.length} completados</Text></View>
        <View style={s.panel}>
          <View style={s.habitSummary}><View><Text style={s.percent}>67<Text style={s.percentUnit}>%</Text></Text><Text style={s.muted}>Tu progreso de hoy</Text></View><View style={s.successPill}><View style={s.pillDot} /><Text style={s.successText}>En camino</Text></View></View>
          {habits.map((habit, i) => <View key={habit.id} style={[s.habitRow, i === 0 && s.firstRow]}><View style={s.habitIcon}><Text style={s.habitIconText}>{habit.icon}</Text></View><Text style={s.habitName}>{habit.title}</Text><TouchableOpacity style={[s.check, habit.done && s.checked]}><Text style={s.checkText}>{habit.done ? '✓' : ''}</Text></TouchableOpacity></View>)}
        </View>

        <View style={s.sectionHead}><Text style={s.sectionTitle}>Esta semana</Text><Text style={s.greenText}>Ver semana →</Text></View>
        <View style={s.panel}>
          <View style={s.statsRow}><Stat value="12" label="Programadas" /><View style={s.statDivider} /><Stat value="5" label="Pendientes" /><View style={s.statDivider} /><Stat value="7" label="Completadas" /></View>
          <View style={s.taskLine}><View style={s.taskMark} /><View style={s.taskCopy}><Text style={s.taskTitle}>Preparar presupuesto</Text><Text style={s.taskDate}>HOY · 10:30</Text></View><Text style={s.arrow}>›</Text></View>
        </View>
        <View style={s.bottomSpace} />
      </ScrollView>
      <View style={s.nav}>{[['Inicio','⌂'],['Finanzas','◷'],['Hábitos','✳'],['Tareas','☷']].map(([name, icon]) => <TouchableOpacity key={name} style={s.navItem} onPress={() => setTab(name)}><Text style={[s.navIcon, tab === name && s.navSelected]}>{icon}</Text><Text style={[s.navLabel, tab === name && s.navSelected]}>{name}</Text></TouchableOpacity>)}</View>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Faltan datos', 'Escribe tu correo y contraseña.');
    setBusy(true);
    try {
      if (mode === 'signup') await registerWithEmail(email, password);
      else await signInWithEmail(email, password);
    } catch (error) {
      Alert.alert(mode === 'signup' ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={s.authScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.authMark}><Text style={s.authMarkText}>P</Text></View>
        <Text style={s.authTitle}>{mode === 'signup' ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</Text>
        <Text style={s.authSubtitle}>Tus finanzas, hábitos y semana en un solo lugar.</Text>
        <Text style={s.inputLabel}>CORREO ELECTRÓNICO</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="tu@correo.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
        <Text style={s.inputLabel}>CONTRASEÑA</Text>
        <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Tu contraseña" placeholderTextColor="#9CA3AF" secureTextEntry textContentType={mode === 'signup' ? 'newPassword' : 'password'} />
        <TouchableOpacity style={[s.authButton, busy && s.authButtonBusy]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.authButtonText}>{mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.authSwitch} onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          <Text style={s.authSwitchText}>{mode === 'signup' ? '¿Ya tienes cuenta? ' : '¿Primera vez aquí? '}<Text style={s.authSwitchStrong}>{mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</Text></Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Quick({ label, icon, tone }: { label: string; icon: string; tone: string }) { return <TouchableOpacity style={s.quick}><View style={[s.quickIcon, tone === 'green' ? s.quickGreen : tone === 'black' ? s.quickBlack : s.quickOutline]}><Text style={[s.quickGlyph, tone === 'outline' && s.outlineGlyph]}>{icon}</Text></View><Text style={s.quickLabel}>{label}</Text></TouchableOpacity>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAF8' }, page: { paddingHorizontal: 20, paddingTop: 12 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: MUTED, fontSize: 10, letterSpacing: 1.1, fontWeight: '700' }, title: { color: INK, fontSize: 24, fontWeight: '800', marginTop: 5 }, wave: { color: GREEN, fontSize: 21 }, avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#15803D', fontSize: 17, fontWeight: '800' },
  balanceCard: { backgroundColor: '#111827', borderRadius: 24, padding: 20, marginBottom: 25 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between' }, cardLabel: { color: '#A7F3D0', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, trend: { color: '#86EFAC', fontSize: 12, fontWeight: '700' }, balance: { color: '#FFF', fontSize: 34, fontWeight: '800', marginTop: 12, letterSpacing: -1 }, balanceFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 11 }, balanceSub: { color: '#9CA3AF', fontSize: 11 }, whiteStrong: { color: '#FFF', fontWeight: '700' }, dot: { width: 4, height: 4, borderRadius: 3, backgroundColor: '#4B5563', marginHorizontal: 10 }, progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#374151', marginTop: 19 }, progressFill: { width: '72%', height: 5, borderRadius: 4, backgroundColor: '#4ADE80' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sectionTitle: { color: INK, fontSize: 16, fontWeight: '800' }, muted: { color: MUTED, fontSize: 12 }, greenText: { color: GREEN, fontSize: 12, fontWeight: '700' }, quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 }, quick: { width: '31%', alignItems: 'center' }, quickIcon: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, quickGreen: { backgroundColor: GREEN }, quickBlack: { backgroundColor: INK }, quickOutline: { backgroundColor: '#FFF', borderWidth: 1, borderColor: LINE }, quickGlyph: { color: '#FFF', fontSize: 23, fontWeight: '500' }, outlineGlyph: { color: INK }, quickLabel: { color: '#374151', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  panel: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF0EE', paddingHorizontal: 15, marginBottom: 24 }, habitSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }, percent: { color: INK, fontSize: 25, fontWeight: '800' }, percentUnit: { fontSize: 15 }, successPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 10 }, pillDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 }, successText: { color: '#15803D', fontSize: 10, fontWeight: '700' }, habitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }, firstRow: { borderTopWidth: 0 }, habitIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }, habitIconText: { color: GREEN, fontSize: 16 }, habitName: { color: '#374151', fontSize: 12, fontWeight: '600', flex: 1, marginLeft: 10 }, check: { width: 22, height: 22, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' }, checked: { backgroundColor: GREEN, borderColor: GREEN }, checkText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: INK, fontSize: 20, fontWeight: '800' }, statLabel: { color: MUTED, fontSize: 9, marginTop: 3 }, statDivider: { width: 1, height: 29, backgroundColor: LINE }, taskLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F3F4F6' }, taskMark: { width: 17, height: 17, borderRadius: 6, borderWidth: 1.5, borderColor: GREEN }, taskCopy: { flex: 1, marginLeft: 10 }, taskTitle: { color: '#374151', fontSize: 12, fontWeight: '700' }, taskDate: { color: MUTED, fontSize: 9, marginTop: 4, letterSpacing: .5 }, arrow: { color: '#9CA3AF', fontSize: 22 }, bottomSpace: { height: 20 },
  nav: { height: 66, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: LINE, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, navItem: { alignItems: 'center', width: '25%' }, navIcon: { fontSize: 19, color: '#9CA3AF' }, navLabel: { color: '#9CA3AF', fontSize: 9, marginTop: 3, fontWeight: '600' }, navSelected: { color: GREEN, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, authScreen: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 }, authMark: { width: 52, height: 52, borderRadius: 18, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, authMarkText: { color: '#FFF', fontSize: 26, fontWeight: '900' }, authTitle: { color: INK, fontSize: 27, fontWeight: '800', letterSpacing: -.5 }, authSubtitle: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 32 }, inputLabel: { color: '#4B5563', fontSize: 10, fontWeight: '800', letterSpacing: .9, marginBottom: 8, marginTop: 15 }, input: { height: 52, backgroundColor: '#FFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, paddingHorizontal: 15, color: INK, fontSize: 14 }, authButton: { height: 54, marginTop: 25, borderRadius: 15, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' }, authButtonBusy: { opacity: .75 }, authButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' }, authSwitch: { alignItems: 'center', paddingVertical: 20 }, authSwitchText: { color: MUTED, fontSize: 13 }, authSwitchStrong: { color: GREEN, fontWeight: '800' },
});
