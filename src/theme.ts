/** Sistema de diseño "Azokar Space": espacio profundo, superficies sutiles y un único acento verde. Sin morados. */
export const colors = {
  void: '#04060B',
  night: '#070B13',
  surface: '#0B1220',
  surfaceRaised: '#101A2C',
  line: 'rgba(160, 190, 230, 0.10)',
  lineStrong: 'rgba(160, 190, 230, 0.20)',
  ink: '#EAF0F8',
  inkSoft: '#B4C0D2',
  muted: '#74839A',
  accent: '#5EEAB4',
  accentDeep: '#0F3A2C',
  accentGlow: 'rgba(94, 234, 180, 0.12)',
  onAccent: '#04150F',
  danger: '#FF8A9B',
  dangerSoft: 'rgba(255, 138, 155, 0.12)',
  backdrop: 'rgba(2, 4, 9, 0.86)',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  overline: { fontSize: 10, letterSpacing: 2, fontWeight: '600' as const, color: colors.muted },
  display: { fontSize: 38, letterSpacing: -1.2, fontWeight: '300' as const, color: colors.ink },
  title: { fontSize: 26, letterSpacing: -0.6, fontWeight: '300' as const, color: colors.ink },
  heading: { fontSize: 15, letterSpacing: 0.2, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.muted },
};

export const money = (value: number) => `$${value.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
