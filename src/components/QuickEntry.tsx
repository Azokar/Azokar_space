import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeInDown, FadeOutDown, ReduceMotion, Easing as REasing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { getApiKey } from '../lib/apiKey';
import { GeminiError } from '../lib/gemini';
import { interpret, loadContext, saveAction, undoSaved, type QuickAction, type QuickContext, type Saved } from '../lib/quickEntry';
import { MOTION_BASE, MOTION_EXIT, PRESS_SCALE, SPRING } from '../lib/motion';
import { useToday } from '../lib/useToday';
import { weekdayName } from '../lib/workouts';
import { shortDate } from '../lib/fixedExpenses';
import { Icon } from './ui';
import { colors, money, radius, space } from '../theme';

type Phase = 'idle' | 'listening' | 'processing';
type Banner = { tone: 'ok' | 'error' | 'info'; title: string; detail?: string; saved?: Saved; goProfile?: boolean };

const KIND_LABEL: Record<QuickAction['type'], string> = { expense: 'Gasto guardado', task: 'Tarea guardada', exercise: 'Serie guardada' };

function describe(action: QuickAction) {
  if (action.type === 'expense') return `${money(action.amount)} · ${action.category} · ${shortDate(action.date)}${action.note ? ` · ${action.note}` : ''}`;
  if (action.type === 'task') return `${action.title} · ${shortDate(action.date)}`;
  return `${action.exerciseName} · ${action.weight > 0 ? `${action.weight} kg` : 'peso corporal'} × ${action.reps}`;
}

type Props = {
  userId: string;
  /** Distancia desde el borde inferior de la pantalla (para quedar sobre la barra de navegación). */
  bottom: number;
  /** Avisa a las pantallas de que hay datos nuevos para que se recarguen. */
  onSaved: () => void;
  onOpenProfile: () => void;
  /** Oculta el botón (por ejemplo con el teclado abierto). */
  hideButton?: boolean;
};

/**
 * Registro rápido por voz: el usuario toca el botón y dice qué registrar ("gasto de ocio 150 mil"). La voz se convierte en
 * texto en el teléfono, Gemini (con la clave personal del usuario) lo interpreta y el registro se guarda solo en su
 * sitio. No hay formularios: un aviso dice qué se guardó y permite deshacerlo.
 */
export default function QuickEntry({ userId, bottom, onSaved, onOpenProfile, hideButton }: Props) {
  const today = useToday();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busyUndo, setBusyUndo] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const heardRef = useRef('');
  const handled = useRef(false);
  const apiKey = useRef<string | null>(null);
  const context = useRef<Promise<QuickContext> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const showBanner = (next: Banner | null, ms = 7000) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(next);
    if (next && next.tone !== 'info') bannerTimer.current = setTimeout(() => setBanner(null), ms);
  };
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.7 }] }));
  useEffect(() => {
    if (phase !== 'listening' || reduceMotion) { pulse.value = 0; return; }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1100, easing: REasing.out(REasing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [phase, reduceMotion, pulse]);

  const process = async (text: string) => {
    if (handled.current) return;
    handled.current = true;
    const spoken = text.trim();
    if (!spoken) { changePhase('idle'); showBanner({ tone: 'error', title: 'No te escuché', detail: 'Toca el botón y di qué quieres registrar.' }); return; }
    changePhase('processing');
    try {
      const ctx = await context.current;
      if (!apiKey.current || !ctx) throw new Error('Faltan datos para interpretar.');
      const result = await interpret(apiKey.current, spoken, ctx);
      if ('error' in result) { showBanner({ tone: 'error', title: result.error, detail: `Escuché: "${spoken}"` }, 9000); return; }
      const saved = await saveAction(userId, result.action);
      showBanner({ tone: 'ok', title: KIND_LABEL[result.action.type], detail: describe(result.action), saved });
      onSaved();
    } catch (reason) {
      const isKey = reason instanceof GeminiError && reason.code === 'key';
      showBanner({ tone: 'error', title: reason instanceof Error ? reason.message : 'No se pudo registrar. Inténtalo de nuevo.', goProfile: isKey }, 9000);
    } finally { changePhase('idle'); setHeard(''); }
  };

  useSpeechRecognitionEvent('result', event => {
    const transcript = event.results[0]?.transcript ?? '';
    heardRef.current = transcript; setHeard(transcript);
    if (event.isFinal && phaseRef.current === 'listening') void process(transcript);
  });
  useSpeechRecognitionEvent('end', () => {
    // El reconocedor se detuvo (silencio o el usuario tocó de nuevo): se usa lo último que se escuchó.
    if (phaseRef.current === 'listening') void process(heardRef.current);
  });
  useSpeechRecognitionEvent('error', event => {
    if (event.error === 'aborted' || phaseRef.current !== 'listening') return;
    handled.current = true; changePhase('idle'); setHeard('');
    if (event.error === 'no-speech') showBanner({ tone: 'error', title: 'No te escuché', detail: 'Toca el botón y di qué quieres registrar.' });
    else if (event.error === 'not-allowed') showBanner({ tone: 'error', title: 'Falta el permiso del micrófono', detail: 'Actívalo en los ajustes del teléfono para esta app.' });
    else showBanner({ tone: 'error', title: 'No se pudo usar el reconocimiento de voz', detail: event.message || 'Inténtalo de nuevo.' });
  });

  const start = async () => {
    showBanner(null);
    const key = await getApiKey(userId);
    if (!key) { showBanner({ tone: 'error', title: 'Falta tu clave de Gemini', detail: 'Pégala en tu perfil para registrar con la voz.', goProfile: true }, 9000); return; }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) { showBanner({ tone: 'error', title: 'Falta el permiso del micrófono', detail: 'Actívalo en los ajustes del teléfono para esta app.' }, 9000); return; }
    apiKey.current = key;
    context.current = loadContext(userId, today, weekdayName(today));
    context.current.catch(() => {});
    handled.current = false; heardRef.current = ''; setHeard('');
    changePhase('listening');
    ExpoSpeechRecognitionModule.start({ lang: 'es-CO', interimResults: true, continuous: false, maxAlternatives: 1 });
  };

  const stop = () => { ExpoSpeechRecognitionModule.stop(); };
  const cancel = () => { handled.current = true; changePhase('idle'); setHeard(''); ExpoSpeechRecognitionModule.abort(); };

  const onPressButton = () => {
    if (phase === 'listening') stop();
    else if (phase === 'idle') void start();
  };

  const undo = async () => {
    const saved = banner?.saved;
    if (!saved) return;
    setBusyUndo(true);
    try { await undoSaved(userId, saved); showBanner({ tone: 'info', title: 'Registro deshecho' }); setTimeout(() => setBanner(null), 2500); onSaved(); }
    catch (reason) { showBanner({ tone: 'error', title: reason instanceof Error ? reason.message : 'No se pudo deshacer.' }); }
    finally { setBusyUndo(false); }
  };

  const listening = phase === 'listening';
  const panelVisible = listening || phase === 'processing';
  return <>
    {panelVisible && <Reanimated.View entering={FadeInDown.duration(MOTION_BASE).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(MOTION_EXIT).reduceMotion(ReduceMotion.System)} style={[styles.panel, { bottom: bottom + 72 }]} accessibilityLiveRegion="polite">
      {listening ? <>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelLabel}>ESCUCHANDO</Text>
          <Text style={heard ? styles.panelText : styles.panelHint} numberOfLines={3}>{heard || 'Di, por ejemplo: "gasto de ocio 150 mil"'}</Text>
        </View>
        <Pressable onPress={cancel} hitSlop={6} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancelar"><Icon name="x" size={20} color={colors.inkSoft} /></Pressable>
      </> : <>
        <ActivityIndicator color={colors.accent} />
        <View style={{ flex: 1 }}><Text style={styles.panelLabel}>INTERPRETANDO</Text>{!!heard || !!heardRef.current ? <Text style={styles.panelText} numberOfLines={2}>{heard || heardRef.current}</Text> : null}</View>
      </>}
    </Reanimated.View>}

    {!panelVisible && banner && <Reanimated.View entering={FadeInDown.duration(MOTION_BASE).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(MOTION_EXIT).reduceMotion(ReduceMotion.System)} style={[styles.panel, banner.tone === 'error' && styles.panelError, { bottom: bottom + 72 }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.bannerIcon, banner.tone === 'error' && { backgroundColor: colors.dangerSoft }]}><Icon name={banner.tone === 'error' ? 'alert-triangle' : banner.tone === 'ok' ? 'check' : 'rotate-ccw'} size={18} color={banner.tone === 'error' ? colors.danger : colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.panelText} numberOfLines={3}>{banner.title}</Text>
        {!!banner.detail && <Text style={styles.panelDetail} numberOfLines={3}>{banner.detail}</Text>}
      </View>
      {banner.saved && <Pressable onPress={undo} disabled={busyUndo} hitSlop={6} style={styles.action} accessibilityRole="button" accessibilityLabel="Deshacer el último registro"><Text style={styles.actionText}>Deshacer</Text></Pressable>}
      {banner.goProfile && <Pressable onPress={() => { setBanner(null); onOpenProfile(); }} hitSlop={6} style={styles.action} accessibilityRole="button" accessibilityLabel="Abrir mi perfil"><Text style={styles.actionText}>Perfil</Text></Pressable>}
    </Reanimated.View>}

    {!hideButton && <Reanimated.View style={[styles.fabWrap, { bottom }, pressStyle]} pointerEvents="box-none">
      {listening && <Reanimated.View pointerEvents="none" style={[styles.ring, ringStyle]} />}
      <Pressable
        onPress={onPressButton}
        onPressIn={() => { scale.value = withSpring(PRESS_SCALE, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        disabled={phase === 'processing'}
        style={[styles.fab, listening && styles.fabListening]}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Terminar de dictar' : 'Registro por voz'}
        accessibilityHint={listening ? 'Termina y registra lo que dijiste' : 'Toca y di qué quieres registrar'}
      ><Icon name={listening ? 'square' : 'mic'} size={22} color={listening ? colors.accent : colors.onAccent} /></Pressable>
    </Reanimated.View>}
  </>;
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 20, width: 56, height: 56 },
  ring: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fabListening: { backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: colors.accent },
  panel: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong, elevation: 10 },
  panelError: { borderColor: 'rgba(255, 138, 155, 0.45)' },
  panelLabel: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 4 },
  panelText: { color: colors.ink, fontSize: 15, fontWeight: '500' },
  panelHint: { color: colors.muted, fontSize: 14 },
  panelDetail: { color: colors.inkSoft, fontSize: 13, marginTop: 3 },
  cancel: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bannerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGlow },
  action: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  actionText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
