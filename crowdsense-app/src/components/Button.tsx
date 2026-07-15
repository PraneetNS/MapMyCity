import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ViewStyle,
  TextStyle,
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
  variant?: 'primary' | 'secondary' | 'danger';
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 100 });
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: {
            backgroundColor: theme.colors.neutral[200],
            borderWidth: 1,
            borderColor: theme.colors.neutral[300],
            shadowOpacity: 0,
            elevation: 0,
          },
          text: {
            color: theme.colors.neutral[800],
          },
          loaderColor: theme.colors.secondary,
        };
      case 'danger':
        return {
          button: {
            backgroundColor: theme.colors.status.rejected,
          },
          text: {
            color: theme.colors.white,
          },
          loaderColor: theme.colors.white,
        };
      case 'primary':
      default:
        return {
          button: {
            backgroundColor: theme.colors.primary,
          },
          text: {
            color: theme.colors.white,
          },
          loaderColor: theme.colors.white,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const dynamicStyles = StyleSheet.create({
    disabledButton: {
      backgroundColor: theme.colors.neutral[300],
      borderColor: theme.colors.neutral[300],
      shadowOpacity: 0,
      elevation: 0,
    },
    disabledText: {
      color: theme.colors.neutral[500],
    },
  });

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
        disabled && dynamicStyles.disabledButton,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.loaderColor} />
      ) : (
        <>
          {icon && <Animated.View style={styles.iconContainer}>{icon}</Animated.View>}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              disabled && dynamicStyles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: baseTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: baseTheme.spacing[24],
    ...baseTheme.shadows.low,
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
});
