import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';

interface OfflineBannerProps {
  isOffline: boolean;
}

export function OfflineBanner({ isOffline }: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <WifiOff size={14} color="#FFFFFF" />
      <Text style={styles.text}>Offline Mode — Drafts are safely queued locally</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
