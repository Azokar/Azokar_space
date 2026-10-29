import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Chip, ChipRow, ErrorText, Field } from './ui';
import { space, type } from '../theme';

/** Grupos musculares frecuentes, como atajos. Se combinan con las categorías que ya usas. */
export const COMMON_TAGS = ['Pecho', 'Espalda', 'Piernas', 'Glúteos', 'Hombros', 'Brazos', 'Core', 'Cardio', 'Descanso'];

type Props = {
  day: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  hasTag: boolean;
  busy: boolean;
  error: string;
  onSave: () => void;
  onRemove: () => void;
};

/** Edición de la etiqueta de un día: texto libre con atajos. */
export default function DayTagForm({ day, value, onChange, suggestions, hasTag, busy, error, onSave, onRemove }: Props) {
  const options = [...new Set([...suggestions, ...COMMON_TAGS])];
  return <>
    <Text style={[type.body, { marginTop: space.md, lineHeight: 21 }]}>Una etiqueta corta para saber qué entrenas el {day}, por ejemplo el grupo muscular.</Text>
    <Field label="ETIQUETA" value={value} onChangeText={onChange} placeholder="Ej. Pecho, Glúteos" maxLength={30} autoCapitalize="sentences" />
    <ChipRow scroll style={{ marginTop: space.sm }}>
      {options.map(item => <Chip key={item} label={item} selected={value.trim().toLowerCase() === item.toLowerCase()} onPress={() => onChange(item)} />)}
    </ChipRow>
    <Button label="Guardar etiqueta" onPress={onSave} busy={busy} />
    {hasTag && <Button label="Quitar etiqueta" variant="danger" icon="trash-2" onPress={onRemove} busy={busy} style={{ marginTop: space.md }} />}
    <ErrorText>{error}</ErrorText>
  </>;
}
