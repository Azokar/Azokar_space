import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Starfield } from './ui';
import { colors } from '../theme';

/** Marco de una subruta con sesión: fondo estelar, redirige al inicio si no hay sesión y ofrece volver atrás. */
export default function AuthedScreen({ children }: { children: (userId: string, goBack: () => void) => React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (!data.session) router.replace('/');
    });
    return () => { mounted = false; };
  }, [router]);

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <StatusBar style="light" />
    <Starfield />
    {loading || !session ? <View style={styles.center}><ActivityIndicator color={colors.accent} /></View> : children(session.user.id, goBack)}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.void }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
