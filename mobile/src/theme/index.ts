/**
 * Sufara design tokens.
 *
 * Calm, premium and travel-oriented: deep mosque greens, warm limestone
 * neutrals and a restrained gold accent. Islamic geometry appears as texture
 * (see `PatternTile`) rather than ornament, so usability always leads.
 */
export const colors = {
  background: '#FAF6EF',
  backgroundAlt: '#F2EDE3',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F2EA',

  primary: '#1F6F54',
  primaryDark: '#0F3D2E',
  primaryDeep: '#0A2A20',
  primarySoft: '#E4EFE9',

  gold: '#B4924C',
  goldSoft: '#F4EAD4',

  text: '#16211D',
  textMuted: '#5F6B66',
  textFaint: '#8B948F',
  onPrimary: '#FFFFFF',

  border: '#E6DFD2',
  borderStrong: '#D6CCB9',

  danger: '#A8452F',
  dangerSoft: '#F7E6E1',
  warning: '#8A6A1F',
  warningSoft: '#FBF1DA',
  success: '#1F6F54',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1B2A24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#1B2A24',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

/** Fallback tint when a category has no colour of its own. */
export const CATEGORY_FALLBACK = colors.primary;
