import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'none' | 'low' | 'medium' | 'high';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevation = 'low',
}) => {
  const { theme } = useTheme();

  const getShadowStyle = () => {
    if (elevation === 'none') return {};
    return theme.shadows[elevation];
  };

  const dynamicStyles = StyleSheet.create({
    card: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
  });

  return (
    <View style={[styles.card, dynamicStyles.card, getShadowStyle(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: baseTheme.radius.md,
    padding: baseTheme.spacing[16],
    borderWidth: 1,
  },
});
