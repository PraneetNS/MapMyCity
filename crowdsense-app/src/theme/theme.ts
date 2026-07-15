export const lightColors = {
  primary: '#4F46E5', // Electric Indigo
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  primaryBg: '#EEF2FF',
  
  secondary: '#0F172A', // Slate 900
  secondaryLight: '#334155',
  secondaryBg: '#F1F5F9',

  white: '#FFFFFF',
  black: '#000000',

  neutral: {
    100: '#F8FAFC',
    200: '#F1F5F9',
    300: '#E2E8F0',
    400: '#CBD5E1',
    500: '#94A3B8',
    600: '#64748B',
    700: '#475569',
    800: '#334155',
    900: '#0F172A',
  },

  status: {
    pending: '#D97706', // Amber 600
    pendingBg: '#FEF3C7',
    pendingBorder: '#F59E0B',
    
    approved: '#059669', // Emerald 600
    approvedBg: '#D1FAE5',
    approvedBorder: '#10B981',
    
    rejected: '#DC2626', // Rose 600
    rejectedBg: '#FEE2E2',
    rejectedBorder: '#F87171',
    
    flagged: '#EA580C', // Orange 600
    flaggedBg: '#FFEDD5',
    flaggedBorder: '#F97316',
  },
};

export const darkColors = {
  primary: '#818CF8', // Indigo (lighter shade for better visibility in dark mode)
  primaryLight: '#A5B4FC',
  primaryDark: '#4F46E5',
  primaryBg: '#1E1B4B',
  
  secondary: '#F8FAFC', // Slate 50 (light text/elements)
  secondaryLight: '#E2E8F0',
  secondaryBg: '#0F172A', // Dark container backgrounds

  white: '#1E293B', // Dark card background instead of white
  black: '#FFFFFF', // Light text/contrast instead of black

  neutral: {
    100: '#0F172A', // Dark background
    200: '#1E293B', // Dark border / card background
    300: '#334155',
    400: '#475569',
    500: '#64748B',
    600: '#94A3B8',
    700: '#CBD5E1',
    800: '#E2E8F0',
    900: '#F8FAFC',
  },

  status: {
    pending: '#F59E0B',
    pendingBg: '#451A03',
    pendingBorder: '#D97706',
    
    approved: '#10B981',
    approvedBg: '#064E3B',
    approvedBorder: '#059669',
    
    rejected: '#F87171',
    rejectedBg: '#7F1D1D',
    rejectedBorder: '#DC2626',
    
    flagged: '#F97316',
    flaggedBg: '#7C2D12',
    flaggedBorder: '#EA580C',
  },
};

export const theme = {
  colors: lightColors,

  typography: {
    fontSizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    fontWeights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },

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
    round: 9999,
  },

  shadows: {
    low: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
    high: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

export type ThemeType = typeof theme;
