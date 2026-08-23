import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react-native';

interface NetworkStatusBarProps {
  isOffline: boolean;
  pendingSyncCount?: number;
  isSyncing?: boolean;
  onManualSync?: () => void;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({
  isOffline,
  pendingSyncCount = 0,
  isSyncing = false,
  onManualSync,
}) => {
  const slideAnim = useRef(new Animated.Value(isOffline ? 1 : 0)).current;
  const prevOffline = useRef(isOffline);

  useEffect(() => {
    if (isOffline !== prevOffline.current) {
      Animated.timing(slideAnim, {
        toValue: isOffline ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
      prevOffline.current = isOffline;
    }
  }, [isOffline, slideAnim]);

  if (!isOffline && pendingSyncCount === 0) {
    return null;
  }

  const height = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 42],
  });

  return (
    <Animated.View style={[styles.container, { height, opacity: slideAnim }]}>
      <View style={styles.content}>
        <View style={styles.leftRow}>
          {isOffline ? (
            <WifiOff size={15} color="#F87171" />
          ) : (
            <Wifi size={15} color="#4ADE80" />
          )}
          <Text style={styles.statusText} numberOfLines={1}>
            {isOffline
              ? 'Offline — changes saved on device'
              : 'Back online'}
          </Text>
        </View>

        <View style={styles.rightRow}>
          {pendingSyncCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingSyncCount} queued</Text>
            </View>
          )}

          {!isOffline && onManualSync && (
            <TouchableOpacity
              onPress={onManualSync}
              disabled={isSyncing}
              style={styles.syncButton}
              activeOpacity={0.7}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <RefreshCw size={13} color="#FFFFFF" />
              )}
              <Text style={styles.syncButtonText}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    overflow: 'hidden',
    width: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#F59E0B22',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
