import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionTitle,
  onAction,
  style,
}) => {
  const { theme } = useTheme();

  const dynamicStyles = StyleSheet.create({
    title: {
      color: theme.colors.neutral[800],
    },
    description: {
      color: theme.colors.neutral[500],
    },
  });

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
      <Text style={[styles.description, dynamicStyles.description]}>{description}</Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.actionButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: baseTheme.spacing[32],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconContainer: {
    marginBottom: baseTheme.spacing[16],
    opacity: 0.6,
  },
  title: {
    fontSize: baseTheme.typography.fontSizes.lg,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[8],
    textAlign: 'center',
  },
  description: {
    fontSize: baseTheme.typography.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: baseTheme.spacing[24],
    paddingHorizontal: baseTheme.spacing[16],
  },
  actionButton: {
    width: '100%',
    maxWidth: 200,
  },
});
