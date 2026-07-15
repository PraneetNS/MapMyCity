import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'pending' | 'approved' | 'rejected' | 'flagged' | 'neutral';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  const getBadgeColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: theme.colors.secondaryBg,
          text: theme.colors.secondaryLight,
          border: theme.colors.neutral[300],
        };
      case 'pending':
        return {
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pending,
          border: theme.colors.status.pendingBorder,
        };
      case 'approved':
        return {
          bg: theme.colors.status.approvedBg,
          text: theme.colors.status.approved,
          border: theme.colors.status.approvedBorder,
        };
      case 'rejected':
        return {
          bg: theme.colors.status.rejectedBg,
          text: theme.colors.status.rejected,
          border: theme.colors.status.rejectedBorder,
        };
      case 'flagged':
        return {
          bg: theme.colors.status.flaggedBg,
          text: theme.colors.status.flagged,
          border: theme.colors.status.flaggedBorder,
        };
      case 'neutral':
        return {
          bg: theme.colors.neutral[100],
          text: theme.colors.neutral[600],
          border: theme.colors.neutral[300],
        };
      case 'primary':
      default:
        return {
          bg: theme.colors.primaryBg,
          text: theme.colors.primary,
          border: theme.colors.primaryLight,
        };
    }
  };

  const colors = getBadgeColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: baseTheme.spacing[8],
    paddingVertical: baseTheme.spacing[4],
    borderRadius: baseTheme.radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
