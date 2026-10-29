import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Chevron, Collapsible, Icon } from './ui';
import { shortDate, toDateString } from '../lib/fixedExpenses';
import { colors, radius, space, type } from '../theme';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');

type Props = {
  label?: string;
  /** Fecha elegida, AAAA-MM-DD. */
  value: string;
  onChange: (next: string) => void;
  /** Última fecha seleccionable. Sin valor, no hay límite hacia el futuro. */
  maxDate?: string;
  /** Primera fecha seleccionable. Sin valor, no hay límite hacia el pasado. */
  minDate?: string;
};

/** Campo de fecha con calendario desplegable. No usa módulos nativos, así que funciona en web y Android. */
export default function DatePickerField({ label, value, onChange, maxDate, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(Number(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(value.slice(5, 7)) - 1);

  const today = toDateString(new Date());
  const isToday = value === today;
  const atLatestMonth = !!maxDate && (viewYear > Number(maxDate.slice(0, 4)) || (viewYear === Number(maxDate.slice(0, 4)) && viewMonth >= Number(maxDate.slice(5, 7)) - 1));
  const atEarliestMonth = !!minDate && (viewYear < Number(minDate.slice(0, 4)) || (viewYear === Number(minDate.slice(0, 4)) && viewMonth <= Number(minDate.slice(5, 7)) - 1));

  const toggle = () => {
    if (!open) { setViewYear(Number(value.slice(0, 4))); setViewMonth(Number(value.slice(5, 7)) - 1); }
    setOpen(current => !current);
  };
  const shiftMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear()); setViewMonth(date.getMonth());
  };
  const pick = (day: string) => { onChange(day); setOpen(false); };

  const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // semana desde el lunes
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return <View style={styles.wrap}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={[styles.field, open && styles.fieldOpen]} accessibilityRole="button" accessibilityLabel={`Fecha: ${value}. Cambiar fecha`}>
      <Icon name="calendar" size={18} color={colors.accent} />
      <Text style={styles.value}>{shortDate(value)} {value.slice(0, 4)}</Text>
      {isToday && <View style={styles.tag}><Text style={styles.tagText}>Hoy</Text></View>}
      <View style={{ flex: 1 }} />
      <Chevron open={open} size={18} color={colors.muted} />
    </TouchableOpacity>

    <Collapsible open={open}><View style={styles.calendar}>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} disabled={atEarliestMonth} hitSlop={10} style={[styles.nav, atEarliestMonth && { opacity: 0.3 }]} accessibilityLabel="Mes anterior"><Icon name="chevron-left" size={18} color={colors.ink} /></TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} disabled={atLatestMonth} hitSlop={10} style={[styles.nav, atLatestMonth && { opacity: 0.3 }]} accessibilityLabel="Mes siguiente"><Icon name="chevron-right" size={18} color={colors.ink} /></TouchableOpacity>
      </View>
      <View style={styles.weekRow}>{WEEKDAYS.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`e${index}`} style={styles.cell} />;
          const date = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const disabled = (!!maxDate && date > maxDate) || (!!minDate && date < minDate);
          const selected = date === value;
          return <TouchableOpacity key={date} disabled={disabled} activeOpacity={0.7} onPress={() => pick(date)} style={styles.cell} accessibilityLabel={date}>
            <View style={[styles.day, selected && styles.daySelected, !selected && date === today && styles.dayToday]}>
              <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>{day}</Text>
            </View>
          </TouchableOpacity>;
        })}
      </View>
      <TouchableOpacity onPress={() => pick(toDateString(new Date()))} style={styles.todayButton} accessibilityLabel="Elegir hoy"><Text style={styles.todayText}>Ir a hoy</Text></TouchableOpacity>
    </View></Collapsible>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg },
  label: { ...type.overline, marginBottom: 8 },
  field: { height: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.night, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space.lg },
  fieldOpen: { borderColor: colors.accent },
  value: { color: colors.ink, fontSize: 15 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  tagText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  calendar: { marginTop: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  nav: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  monthTitle: { ...type.heading },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekday: { flex: 1, textAlign: 'center', ...type.caption, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.accent },
  dayToday: { borderWidth: 1, borderColor: colors.accent },
  dayText: { color: colors.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
  dayTextSelected: { color: colors.onAccent, fontWeight: '700' },
  dayTextDisabled: { color: colors.muted, opacity: 0.35 },
  todayButton: { alignSelf: 'center', marginTop: space.sm, paddingVertical: 8, paddingHorizontal: 16 },
  todayText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
