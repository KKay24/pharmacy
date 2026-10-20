import { useColorScheme } from '@/components/useColorScheme';

export const palette = {
  teal: '#00966d',
  tealDark: '#007d5b',
  tealSoft: '#e6f7f2',
  navy: '#0e3854',
  navyDark: '#07213a',
  navySoft: '#eaf1f7',
  orange: '#ff6b35',
  orangeSoft: '#fff3ee',
  slate900: '#0e3854',
  slate800: '#1e293b',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f8fafc',
  slate50: '#fbfdfd',
  white: '#ffffff',
  success: '#00966d',
  successDark: '#007d5b',
  successSoft: '#e6f7f2',
  danger: '#ef4444',
  dangerDark: '#dc2626',
  dangerSoft: '#fef2f2',
  warning: '#f59e0b',
  warningDark: '#d97706',
  warningSoft: '#fffbeb',
  purple: '#8b5cf6',
  purpleSoft: '#f5f3ff',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
} as const;

export const mobileTheme = {
  light: {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    text: '#0e3854',
    textSecondary: '#475569',
    mutedText: '#94a3b8',
    textMuted: '#94a3b8',
    border: '#eef2f6',
    borderLight: '#f1f5f9',
    primary: '#00966d',
    primaryDark: '#007d5b',
    primaryPressed: '#007d5b',
    primarySoft: '#e6f7f2',
    accent: '#ff6b35',
    accentSoft: '#fff3ee',
    navigation: '#0e3854',
    card: '#ffffff',
    success: '#00966d',
    successSoft: '#e6f7f2',
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    info: '#00966d',
    infoSoft: '#e6f7f2',
  },
  dark: {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    text: '#0e3854',
    textSecondary: '#475569',
    mutedText: '#94a3b8',
    textMuted: '#94a3b8',
    border: '#eef2f6',
    borderLight: '#f1f5f9',
    primary: '#00966d',
    primaryDark: '#007d5b',
    primaryPressed: '#007d5b',
    primarySoft: '#e6f7f2',
    accent: '#ff6b35',
    accentSoft: '#fff3ee',
    navigation: '#0e3854',
    card: '#ffffff',
    success: '#00966d',
    successSoft: '#e6f7f2',
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    info: '#00966d',
    infoSoft: '#e6f7f2',
  },
} as const;

export const layout = {
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 9999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
} as const;

export function useTheme() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = isDark ? mobileTheme.dark : mobileTheme.light;
  return { colors, isDark, palette, layout };
}

export default { palette, mobileTheme, layout, useTheme };
