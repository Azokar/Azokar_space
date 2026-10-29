import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, space, type } from '../theme';

export type DayInfo = { total: number; pending: number };

type Props = {
  /** Primer día del mes que se muestra, AAAA-MM-01. */
  monthStart: string;
  today: string;
  selectedDay: string;
  info: Map<string, DayInfo>;
  onSelect: (day: string) => void;
};

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Calendario mensual con las tareas de cada día: punto verde si hay tareas, rojo si es un día pasado con pendientes. */
export default function TaskCalendar({ monthStart, today, selectedDay, info, onSelect }: Props) {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7)) - 1;
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // semana desde el lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return <View style={styles.wrap}>
    <View style={styles.weekRow}>{WEEKDAYS.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
    <View style={styles.grid}>
      {cells.map((day, index) => {
        if (day === null) return <View key={`e${index}`} style={styles.cell} />;
        const date = `${year}-${pad(month + 1)}-${pad(day)}`;
        const data = info.get(date);
        const late = date < today && !!data && data.pending > 0;
        const selected = date === selectedDay;
        return <TouchableOpacity key={date} activeOpacity={0.7} style={styles.cell} onPress={() => onSelect(date)} accessibilityLabel={`${date}${data ? `, ${data.total} ${data.total === 1 ? 'tarea' : 'tareas'}` : ''}${late ? ', con tareas vencidas' : ''}`}>
          <View style={[styles.day, date === today && styles.dayToday, late && styles.dayLate, selected && (late ? styles.daySelectedLate : styles.daySelected)]}>
            <Text style={[styles.dayText, late && styles.dayTextLate, selected && !late && styles.dayTextSelected]}>{day}</Text>
            <View style={styles.dots}>{data ? Array.from({ length: Math.min(data.total, 3) }, (_, i) => <View key={i} style={[styles.dot, late && styles.dotLate, data.pending === 0 && styles.dotDone]} />) : null}</View>
          </View>
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: space.md },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekday: { flex: 1, textAlign: 'center', ...type.caption, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  day: { width: 42, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayToday: { borderColor: colors.lineStrong },
  dayLate: { backgroundColor: colors.dangerSoft },
  daySelected: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  daySelectedLate: { borderColor: colors.danger, backgroundColor: 'rgba(255, 138, 155, 0.22)' },
  dayText: { color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  dayTextLate: { color: colors.danger, fontWeight: '600' },
  dayTextSelected: { color: colors.accent, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 3, height: 5, marginTop: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  dotLate: { backgroundColor: colors.danger },
  dotDone: { backgroundColor: colors.muted },
});
