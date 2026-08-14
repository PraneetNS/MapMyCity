import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { isLiteModeEnabled } from '../services/liteMode';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);
  const isLite = isLiteModeEnabled();

  useEffect(() => {
    if (!isLite) {
      opacity.value = withRepeat(
        withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [isLite]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: isLite ? 0.4 : opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.neutral[300],
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SubmissionRowSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton width={64} height={64} borderRadius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

export function ClusterDetailSkeleton() {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Skeleton width="50%" height={20} />
      <Skeleton width="80%" height={14} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  cardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginVertical: 6,
  },
});
