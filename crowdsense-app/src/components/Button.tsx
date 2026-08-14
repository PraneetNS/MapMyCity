import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'vibrant' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 10, stiffness: 100 });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 100 });
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'vibrant':
        return {
          button: {
            backgroundColor: theme.colors.primaryVibrant,
          },
          text: {
            color: '#FFFFFF',
          },
          loaderColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          button: {
            backgroundColor: theme.colors.neutral[100],
            borderWidth: 1,
            borderColor: theme.colors.neutral[300],
          },
          text: {
            color: theme.colors.neutral[800],
          },
          loaderColor: theme.colors.neutral[800],
        };
      case 'ghost':
        return {
          button: {
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
          },
          text: {
            color: theme.colors.primaryVibrant,
          },
          loaderColor: theme.colors.primaryVibrant,
        };
      case 'danger':
        return {
          button: {
            backgroundColor: theme.colors.status.rejected,
          },
          text: {
            color: '#FFFFFF',
          },
          loaderColor: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          button: {
            backgroundColor: theme.colors.primary,
          },
          text: {
            color: '#FFFFFF',
          },
          loaderColor: '#FFFFFF',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.button,
        variantStyles.button,
        disabled && styles.disabledButton,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.loaderColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              disabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: baseTheme.minTouchTarget + 4, // 48pt exceeds 44pt WCAG requirement
    borderRadius: baseTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: baseTheme.spacing[24],
    ...baseTheme.shadows.low,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.semibold,
  },
  iconContainer: {
    marginRight: baseTheme.spacing[8],
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledText: {
    color: '#94A3B8',
  },
});
