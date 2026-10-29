import React from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './ui';
import { colors, radius, space, type } from '../theme';

type Props = { visible: boolean; title: string; onClose: () => void; children: React.ReactNode };

/** Hoja inferior para formularios: sube con el teclado y se puede desplazar. */
export default function FormSheet({ visible, title, onClose, children }: Props) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><View style={styles.backdrop}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.sheet}>
      <View style={styles.grabber} />
      <View style={styles.header}><Text style={[type.title, { flex: 1 }]}>{title}</Text><TouchableOpacity onPress={onClose} hitSlop={6} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar"><Icon name="x" size={22} color={colors.muted} /></TouchableOpacity></View>
      {children}
    </View></ScrollView></View></KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.night, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, padding: 22, paddingBottom: 32 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: space.lg },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
