import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronLeft,
  CheckCheck,
  ShieldAlert,
  Inbox,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { apiFetch } from '../config/apiClient';
import { getUserSession } from '../services/auth';
import { EmptyState, StatusBadge } from '../components';

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'status_change' | 'reply' | 'digest' | 'hazard_alert' | 'system';
  title: string;
  body: string;
  related_cluster_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

interface NotificationCenterScreenProps {
  onBack: () => void;
  onSelectCluster?: (clusterId: string) => void;
}

export default function NotificationCenterScreen({
  onBack,
  onSelectCluster,
}: NotificationCenterScreenProps) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const session = await getUserSession();
      const uid = session?.userId || 'anonymous';
      setUserId(uid);

      const res = await apiFetch<AppNotification[]>(`/notifications?user_id=${uid}`);
      setNotifications(res || []);
    } catch (_) {
      // Fallback notifications if offline
      setNotifications([
        {
          id: 'local-001',
          user_id: 'me',
          type: 'status_change',
          title: 'Report Verified & Approved',
          body: 'Your submitted report on 5th Cross Road has been verified by municipal moderators.',
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    try {
      await apiFetch(`/notifications/read-all?user_id=${userId}`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (_) {}
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.read_at) {
      try {
        await apiFetch(`/notifications/${item.id}/read`, { method: 'POST' });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
      } catch (_) {}
    }

    if (item.related_cluster_id && onSelectCluster) {
      onSelectCluster(item.related_cluster_id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return <CheckCircle2 size={20} color={theme.colors.status.approved} />;
      case 'hazard_alert':
        return <ShieldAlert size={20} color={theme.colors.status.rejected} />;
      case 'digest':
        return <FileText size={20} color={theme.colors.primaryVibrant} />;
      default:
        return <Bell size={20} color={theme.colors.neutral[600]} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.neutral[50] }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: theme.colors.neutral[200] }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <ChevronLeft size={24} color={theme.colors.neutral[900]} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>Notifications</Text>
        <Pressable onPress={handleMarkAllRead} style={styles.readAllBtn}>
          <CheckCheck size={18} color={theme.colors.primaryVibrant} />
          <Text style={[styles.readAllText, { color: theme.colors.primaryVibrant }]}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={theme.colors.primaryVibrant}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="inbox"
              title="No Notifications Yet"
              subtitle="Status updates, weekly digests, and civic alerts will appear here."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          return (
            <Pressable
              onPress={() => handleNotificationPress(item)}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isUnread ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isUnread ? '#BFDBFE' : theme.colors.neutral[200],
                },
              ]}
            >
              <View style={styles.iconCol}>{getNotificationIcon(item.type)}</View>
              <View style={styles.textCol}>
                <View style={styles.itemHeaderRow}>
                  <Text style={[styles.itemTitle, { color: theme.colors.neutral[900] }]}>
                    {item.title}
                  </Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>
                <Text style={[styles.itemBody, { color: theme.colors.neutral[700] }]}>
                  {item.body}
                </Text>
                <Text style={[styles.itemDate, { color: theme.colors.neutral[400] }]}>
                  {new Date(item.created_at).toLocaleDateString()} at{' '}
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  readAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconCol: {
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemDate: {
    fontSize: 11,
    marginTop: 4,
  },
});
