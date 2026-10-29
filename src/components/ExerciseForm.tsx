import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Chip, ChipRow, ErrorText, Field } from './ui';
import { colors, space, type } from '../theme';

export const WEEKDAY_SUGGESTIONS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type Props = {
  name: string; category: string; dayLabel: string;
  onName: (value: string) => void; onCategory: (value: string) => void; onDayLabel: (value: string) => void;
  /** Categorías y rutinas que ya usas, para elegirlas con un toque. */
  categorySuggestions: string[]; daySuggestions: string[];
  submitLabel: string; busy: boolean; error: string; onSubmit: () => void;
};

/** Formulario de ejercicio: nombre, categoría y día asignado, ambos de texto libre con atajos. */
export default function ExerciseForm({ name, category, dayLabel, onName, onCategory, onDayLabel, categorySuggestions, daySuggestions, submitLabel, busy, error, onSubmit }: Props) {
  const days = [...new Set([...WEEKDAY_SUGGESTIONS, ...daySuggestions])];
  return <>
    <Field label="NOMBRE DEL EJERCICIO" value={name} onChangeText={onName} placeholder="Ej. Press de banca" maxLength={80} />
    <Field label="CATEGORÍA" value={category} onChangeText={onCategory} placeholder="Ej. Pecho, Espalda, Piernas" maxLength={40} />
    {categorySuggestions.length > 0 && <ChipRow scroll style={{ marginTop: space.sm }}>
      {categorySuggestions.map(item => <Chip key={item} label={item} selected={category.trim().toLowerCase() === item.toLowerCase()} onPress={() => onCategory(item)} />)}
    </ChipRow>}
    <Field label="DÍA ASIGNADO" value={dayLabel} onChangeText={onDayLabel} placeholder="Ej. Lunes, Push Day" maxLength={40} />
    <ChipRow scroll style={{ marginTop: space.sm }}>
      {days.map(item => <Chip key={item} label={item} selected={dayLabel.trim().toLowerCase() === item.toLowerCase()} onPress={() => onDayLabel(item)} />)}
    </ChipRow>
    <Text style={[type.caption, { marginTop: space.md, color: colors.muted }]}>La categoría y el día son de texto libre: escribe lo que te sirva, como un grupo muscular o el nombre de tu rutina.</Text>
    <Button label={submitLabel} onPress={onSubmit} busy={busy} />
    <ErrorText>{error}</ErrorText>
  </>;
}
