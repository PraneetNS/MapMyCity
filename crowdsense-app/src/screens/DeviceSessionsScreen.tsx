import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * DeviceSessionsScreen — Part 1: Multi-Device Sync (Future Backlog)
 *
 * PRECONDITION GATE: This screen is accessible via Settings only when the
 * MULTI_DEVICE_ENABLED backend flag is true.  Until then the API returns 503
 * and we render a clear "not yet available" empty state.
 *
 * Shows: all active device sessions for the signed-in account.
 * Allows: remote sign-out of any individual session ("lost phone" flow).
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface DeviceSession {
  session_id: string;
  device_label: string;
  platform: 'ios' | 'android' | 'web';
  app_version?: string;
  last_seen_at: string;
  created_at: string;
  is_current?: boolean;
}

interface Props {
  userId: string;
  currentSessionId?: string;
  onBack: () => void;
}

const PLATFORM_ICON: Record<string, string> = {
  ios: '🍎',
  android: '🤖',
  web: '🌐',
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DeviceSessionsScreen({ userId, currentSessionId, onBack }: Props) {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preconditionGated, setPreconditionGated] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/sessions`);
      if (res.status === 503) {
        setPreconditionGated(true);
        return;
      }
      const data = await res.json();
      const enriched = (data.sessions ?? []).map((s: DeviceSession) => ({
        ...s,
        is_current: s.session_id === currentSessionId,
      }));
      setSessions(enriched);
    } catch {
      // Network failure — keep existing list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, currentSessionId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = (session: DeviceSession) => {
    if (session.is_current) {
      Alert.alert('Cannot revoke', 'This is your current session. Sign out normally instead.');
      return;
    }
    Alert.alert(
      'Sign out device?',
      `Remove "${session.device_label}" from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out device',
          style: 'destructive',
          onPress: async () => {
            setRevoking(session.session_id);
            try {
              await fetch(`${API_BASE}/users/${userId}/sessions/${session.session_id}`, {
                method: 'DELETE',
              });
              setSessions(prev => prev.filter(s => s.session_id !== session.session_id));
            } catch {
              Alert.alert('Error', 'Could not revoke session. Try again.');
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  const handleRevokeAll = () => {
    Alert.alert(
      'Sign out all devices?',
      'This will immediately sign out every device except this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out all',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await fetch(`${API_BASE}/users/${userId}/sessions`, { method: 'DELETE' });
              setSessions(prev => prev.filter(s => s.is_current));
            } catch {
              Alert.alert('Error', 'Could not sign out all devices. Try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderSession = ({ item }: { item: DeviceSession }) => (
    <View style={[styles.sessionCard, item.is_current && styles.currentCard]}>
      <View style={styles.sessionLeft}>
        <Text style={styles.platformIcon}>{PLATFORM_ICON[item.platform] ?? '📱'}</Text>
        <View>
          <Text style={styles.deviceLabel}>
            {item.device_label}
            {item.is_current ? '  ✅ This device' : ''}
          </Text>
          <Text style={styles.sessionMeta}>
            {item.app_version ? `v${item.app_version}  ·  ` : ''}
            Last active {formatRelativeTime(item.last_seen_at)}
          </Text>
          <Text style={styles.sessionMeta}>
            Added {formatRelativeTime(item.created_at)}
          </Text>
        </View>
      </View>
      {!item.is_current && (
        <TouchableOpacity
          style={styles.revokeBtn}
          onPress={() => handleRevoke(item)}
          disabled={revoking === item.session_id}
        >
          {revoking === item.session_id
            ? <ActivityIndicator size="small" color="#FF6B6B" />
            : <Text style={styles.revokeBtnText}>Sign out</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Devices signed in</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : preconditionGated ? (
        /* ── Precondition not met — informational empty state ── */
        <View style={styles.centered}>
          <Text style={styles.gatedIcon}>🔒</Text>
          <Text style={styles.gatedTitle}>Coming soon</Text>
          <Text style={styles.gatedBody}>
            Multi-device sync is being rolled out gradually. Once enabled for your account,
            you'll be able to see and manage all devices signed in here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.session_id}
          renderItem={renderSession}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {sessions.length} device{sessions.length !== 1 ? 's' : ''} signed in to your account
            </Text>
          }
          ListFooterComponent={
            sessions.length > 1 ? (
              <TouchableOpacity style={styles.revokeAllBtn} onPress={handleRevokeAll}>
                <Text style={styles.revokeAllText}>Sign out all other devices</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No other devices found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E1E2E' },
  backBtn: { marginRight: 12 },
  backText: { color: '#6C63FF', fontSize: 16 },
  title: { color: '#E8E8F0', fontSize: 18, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 16, gap: 12 },
  listHeader: { color: '#888', fontSize: 13, marginBottom: 8 },
  sessionCard: {
    backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#252540',
  },
  currentCard: { borderColor: '#6C63FF', borderWidth: 1.5 },
  sessionLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  platformIcon: { fontSize: 28, marginTop: 2 },
  deviceLabel: { color: '#E8E8F0', fontSize: 15, fontWeight: '600' },
  sessionMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  revokeBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#FF6B6B',
  },
  revokeBtnText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600' },
  revokeAllBtn: {
    marginTop: 24, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#FF6B6B',
    alignItems: 'center',
  },
  revokeAllText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600' },
  gatedIcon: { fontSize: 48, marginBottom: 16 },
  gatedTitle: { color: '#E8E8F0', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  gatedBody: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyText: { color: '#888', fontSize: 14 },
});
