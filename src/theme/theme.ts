export const colors = {
  background: '#0A0E1A',
  darkBackground: '#000000',
  surface: '#151929',
  surfaceElevated: '#1E2438',
  surfaceBorder: '#2A324B',
  cardDark: '#1C1C1E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  accentYellow: '#FFD600',
  
  // Incident Categories
  critical: '#FFAB40', // Amber/Orange
  community: '#40C4FF', // Cyan
  civic: '#69F0AE', // Neon Mint Green
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  // States
  danger: '#FF5252',
  success: '#69F0AE',
  warning: '#FFD740',
  info: '#40C4FF',
  
  // Alpha overlays
  overlayDark: 'rgba(10, 14, 26, 0.75)',
  overlayBlack: 'rgba(0, 0, 0, 0.65)',
  cardGlow: 'rgba(64, 196, 255, 0.15)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 30,
  round: 9999,
} as const;

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  glowCritical: {
    shadowColor: colors.critical,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  glowCommunity: {
    shadowColor: colors.community,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  glowCivic: {
    shadowColor: colors.civic,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  fab: {
    shadowColor: colors.critical,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;
