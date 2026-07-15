import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as baseTheme, lightColors, darkColors } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  theme: typeof baseTheme & { colors: typeof lightColors };
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const systemScheme = useColorScheme();

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('CROWDSENSE_THEME_MODE');
        if (savedMode) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    };
    loadThemeMode();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('CROWDSENSE_THEME_MODE', mode);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const toggleTheme = () => {
    if (themeMode === 'light') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('system');
    } else {
      setThemeMode('light');
    }
  };

  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const activeColors = isDark ? darkColors : lightColors;

  const activeTheme = {
    ...baseTheme,
    colors: activeColors,
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, theme: activeTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
