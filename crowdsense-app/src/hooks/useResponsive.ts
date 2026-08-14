/**
 * useResponsive.ts
 * 
 * Comprehensive responsive design hook for universal device compatibility:
 * - Small low-end phones (~5", 320-360dp width)
 * - Standard phones (~6-6.5", 375-414dp width)
 * - Phablets & Large Phones (428dp+ width)
 * - Foldables & Tablets (768dp+ width in portrait / landscape)
 * - Master-Detail layout triggers
 */

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isLandscape: boolean;
  isSmallPhone: boolean;       // < 360dp
  isStandardPhone: boolean;    // 360dp - 767dp
  isTablet: boolean;           // >= 768dp
  isLargeTablet: boolean;      // >= 1024dp
  isMasterDetail: boolean;     // >= 768dp or landscape >= 600dp
  columns: number;             // Adaptive grid column count
  contentMaxWidth: number;     // Constrained max content width
  insets: EdgeInsets;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isLandscape = width > height;
  const isSmallPhone = width < 360;
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isStandardPhone = width >= 360 && width < 768;
  const isMasterDetail = isTablet || (isLandscape && width >= 600);

  let columns = 1;
  if (isLargeTablet) {
    columns = 3;
  } else if (isTablet || (isLandscape && width >= 600)) {
    columns = 2;
  }

  const contentMaxWidth = isLargeTablet ? 1100 : isTablet ? 840 : width;

  return {
    width,
    height,
    isLandscape,
    isSmallPhone,
    isStandardPhone,
    isTablet,
    isLargeTablet,
    isMasterDetail,
    columns,
    contentMaxWidth,
    insets,
  };
}
