import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

interface LoadingSpinnerProps {
  message?: string;
  fullscreen?: boolean;
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  fullscreen = false,
  style,
}) => {
  const { theme } = useTheme();

  const dynamicStyles = StyleSheet.create({
    fullscreen: {
      backgroundColor: theme.colors.neutral[100],
    },
    message: {
      color: theme.colors.neutral[600],
    },
    inlineMessage: {
      color: theme.colors.neutral[600],
    },
  });

  if (fullscreen) {
    return (
      <View style={[styles.fullscreen, dynamicStyles.fullscreen, style]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        {message && <Text style={[styles.message, dynamicStyles.message]}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.inline, style]}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      {message && <Text style={[styles.inlineMessage, dynamicStyles.inlineMessage]}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[24],
  },
  inline: {
    padding: baseTheme.spacing[16],
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: baseTheme.spacing[8],
  },
  message: {
    marginTop: baseTheme.spacing[12],
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.medium,
    textAlign: 'center',
  },
  inlineMessage: {
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.medium,
  },
});
