import React from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText } from './ui';
import { colors, radius, space, type } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Hoja de confirmación para acciones destructivas. Sustituye a Alert.alert, que no funciona en web. */
export default function ConfirmSheet({ visible, title, message, detail, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><View style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={type.title}>{title}</Text>
      <Text style={[type.body, styles.message]}>{message}</Text>
      {detail ? <Text style={[type.caption, styles.detail]}>{detail}</Text> : null}
      <Button label={confirmLabel} variant="danger" icon="trash-2" onPress={onConfirm} busy={busy} />
      <Button label="Cancelar" variant="ghost" onPress={onCancel} style={{ marginTop: space.md }} />
      <ErrorText>{error}</ErrorText>
    </View></View></KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.night, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, padding: 22, paddingBottom: 32 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: space.lg },
  message: { marginTop: space.md, lineHeight: 21 },
  detail: { marginTop: space.md, lineHeight: 19 },
});
