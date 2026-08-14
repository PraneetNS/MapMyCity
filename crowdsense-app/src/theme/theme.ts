/**
 * Single Source-of-Truth Design Tokens for CrowdSense Mobile Application
 * Defined per DESIGN_SYSTEM.md specifications.
 */

export const lightColors = {
  // Brand Civic Colors
  primary: '#0F172A', // Slate 900 — Grounded civic authority
  primaryLight: '#38BDF8',
  primaryVibrant: '#2563EB', // Royal Blue — High-energy CTA accent
  primaryAccent: '#0284C7', // Sky Blue — Interactive highlight
  primaryBg: '#F1F5F9', // Slate 100 — Soft container fill

  secondary: '#1E293B', // Slate 800
  secondaryLight: '#475569',
  secondaryBg: '#F8FAFC',

  white: '#FFFFFF',
  black: '#0F172A',

  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Semantic Status Colors (Uniform across client & admin)
  status: {
    pending: '#D97706', // Amber 600
    pendingBg: '#FEF3C7',
    pendingBorder: '#F59E0B',

    approved: '#16A34A', // Emerald 600
    approvedBg: '#DCFCE7',
    approvedBorder: '#22C55E',

    rejected: '#DC2626', // Rose 600
    rejectedBg: '#FEE2E2',
    rejectedBorder: '#EF4444',

    flagged: '#EA580C', // Orange 600
    flaggedBg: '#FFEDD5',
    flaggedBorder: '#F97316',

    safety: '#DB2777', // Pink 600 (Women's Safety)
    safetyBg: '#FCE7F3',
    safetyBorder: '#EC4899',

    utility: '#059669', // Teal 600 (Utility Outages)
    utilityBg: '#D1FAE5',
    utilityBorder: '#10B981',
  },
};

export const darkColors = {
  primary: '#38BDF8', // Light Sky Blue for high contrast in dark mode
  primaryLight: '#7DD3FC',
  primaryVibrant: '#60A5FA',
  primaryAccent: '#38BDF8',
  primaryBg: '#0F172A',

  secondary: '#F8FAFC',
  secondaryLight: '#CBD5E1',
  secondaryBg: '#1E293B',

  white: '#1E293B',
  black: '#FFFFFF',

  neutral: {
    50: '#0F172A',
    100: '#1E293B',
    200: '#334155',
    300: '#475569',
    400: '#64748B',
    500: '#94A3B8',
    600: '#CBD5E1',
    700: '#E2E8F0',
    800: '#F1F5F9',
    900: '#F8FAFC',
  },

  status: {
    pending: '#F59E0B',
    pendingBg: '#451A03',
    pendingBorder: '#D97706',

    approved: '#22C55E',
    approvedBg: '#064E3B',
    approvedBorder: '#16A34A',

    rejected: '#EF4444',
    rejectedBg: '#7F1D1D',
    rejectedBorder: '#DC2626',

    flagged: '#F97316',
    flaggedBg: '#7C2D12',
    flaggedBorder: '#EA580C',

    safety: '#F472B6',
    safetyBg: '#831843',
    safetyBorder: '#DB2777',

    utility: '#34D399',
    utilityBg: '#064E3B',
    utilityBorder: '#059669',
  },
};

export const theme = {
  colors: lightColors,

  // Minimum Tap Target standard
  minTouchTarget: 44,

  // Indic & Latin Scaled Typography
  typography: {
    fontSizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      display: 32,
    },
    fontWeights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },

  // 4/8/16/24/32/48px Grid Scale
  spacing: {
    4: 4,
    8: 8,
    12: 12,
    16: 16,
    24: 24,
    32: 32,
    48: 48,
  },

  radius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
    round: 9999,
  },

  shadows: {
    low: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
    high: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

export type ThemeType = typeof theme;
