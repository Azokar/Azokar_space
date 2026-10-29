import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Field } from './ui';
import { formatWeight } from '../lib/workouts';
import { colors, radius, space, type } from '../theme';

/** Un peso mayor que esta cantidad de veces tu mejor marca se considera sospechoso y pide confirmación. */
export const OUTLIER_FACTOR = 2.5;

type Props = {
  weight: string; reps: string;
  onWeight: (value: string) => void; onReps: (value: string) => void;
  /** Referencia, por ejemplo "Última serie: 60 kg × 10 · hace 3 días". */
  hint?: string;
  /** Tu mejor peso hasta ahora: sirve para avisar si el dato nuevo parece un error de tecleo (750 en vez de 75). */
  bestWeight?: number;
  submitLabel?: string; busy: boolean; error: string; onSubmit: () => void;
};

/** Registro de una serie: carga y repeticiones. La fecha y la hora se guardan solas al registrar. */
export default function LogForm({ weight, reps, onWeight, onReps, hint, bestWeight = 0, submitLabel = 'Guardar registro', busy, error, onSubmit }: Props) {
  const [warned, setWarned] = useState(false);
  const parsed = parseLog(weight, reps);
  const suspicious = typeof parsed !== 'string' && bestWeight > 0 && parsed.weight > bestWeight * OUTLIER_FACTOR;

  const submit = () => {
    // Primer toque con un peso sospechoso: avisa. Segundo toque: guarda de todas formas.
    if (suspicious && !warned) { setWarned(true); return; }
    setWarned(false);
    onSubmit();
  };
  const changeWeight = (value: string) => { setWarned(false); onWeight(value); };
  const changeReps = (value: string) => { setWarned(false); onReps(value); };

  return <>
    {hint ? <Text style={[type.caption, styles.hint]}>{hint}</Text> : null}
    <View style={styles.row}>
      <View style={{ flex: 1 }}><Field label="PESO (KG)" value={weight} onChangeText={changeWeight} keyboardType="decimal-pad" placeholder="0" maxLength={7} /></View>
      <View style={{ flex: 1 }}><Field label="REPETICIONES" value={reps} onChangeText={changeReps} keyboardType="number-pad" placeholder="0" maxLength={3} /></View>
    </View>
    {warned && typeof parsed !== 'string' && <View style={styles.warning}>
      <Text style={styles.warningTitle}>¿Seguro que son {formatWeight(parsed.weight)}?</Text>
      <Text style={styles.warningText}>Tu mejor marca es {formatWeight(bestWeight)}. Revisa que no sea un error de tecleo antes de guardar.</Text>
    </View>}
    <Button label={warned ? 'Sí, guardar de todas formas' : submitLabel} icon={warned ? 'alert-triangle' : 'plus'} variant={warned ? 'danger' : 'primary'} onPress={submit} busy={busy} />
    <ErrorText>{error}</ErrorText>
  </>;
}

/** Valida y convierte los campos del formulario. Devuelve el error en español si algo no es válido. */
export function parseLog(weight: string, reps: string): { weight: number; reps: number } | string {
  const w = Number(weight.replace(',', '.'));
  const r = Number(reps);
  if (weight.trim() === '' || !Number.isFinite(w) || w < 0) return 'Escribe el peso en kg (puede ser 0 si no usas carga).';
  if (w > 99999) return 'Ese peso es demasiado alto.';
  if (!Number.isInteger(r) || r < 1 || r > 999) return 'Las repeticiones deben ser un número entero entre 1 y 999.';
  return { weight: Math.round(w * 100) / 100, reps: r };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  hint: { marginTop: space.md, color: colors.muted },
  warning: { marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255, 138, 155, 0.5)', backgroundColor: colors.dangerSoft },
  warningTitle: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  warningText: { ...type.caption, marginTop: 4, lineHeight: 17 },
});
