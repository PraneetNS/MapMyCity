import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  RefreshControl,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  MapPin,
  Calendar,
  Inbox,
  FileText,
  Sparkles,
  Flame,
  CheckCircle,
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { fetchDeviceSubmissions } from '../services/submissions';
import type { Submission } from '../types';
import { getDeviceId } from '../utils/device';
import { apiFetch } from '../config/apiClient';
import {
  Card,
  StatusIndicator,
  StatusBadge,
  Skeleton,
  EmptyState,
  Button,
} from '../components';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubmissionRowSkeleton } from '../components/Skeleton';

const CACHE_KEY_SUBMISSIONS = 'CROWDSENSE_SUBMISSIONS_CACHE';

export default function SubmissionsScreen() {
  const { theme, isDark } = useTheme();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [digest, setDigest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubmissions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      // Stale-While-Revalidate: Load cached data immediately
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY_SUBMISSIONS);
        if (cached) {
          setSubmissions(JSON.parse(cached));
          setLoading(false); // Hide skeleton immediately if cached data exists!
        }
      } catch (_) {}
    }
    setError(null);

    try {
      const deviceId = await getDeviceId();
      const rows = await fetchDeviceSubmissions(deviceId);
      
      const sorted = rows.sort(
        (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      );
      setSubmissions(sorted);
      await AsyncStorage.setItem(CACHE_KEY_SUBMISSIONS, JSON.stringify(sorted));

      // Fetch Smart Activity Digest
      try {
        const digestRes = await apiFetch(`/digest/weekly?user_id=${deviceId}`);
        if (digestRes) setDigest(digestRes);
      } catch (_) {}
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect to reports database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  useFocusEffect(
    useCallback(() => {
      loadSubmissions();
    }, [loadSubmissions])
  );

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadSubmissions(true);
  };

  // Dynamic Styles
  const dynamicStyles = StyleSheet.create({
    loadingContainer: {
      backgroundColor: theme.colors.neutral[100],
    },
    list: {
      backgroundColor: theme.colors.neutral[100],
    },
    cardHeader: {
      borderBottomColor: theme.colors.neutral[200],
    },
    categoryText: {
      color: theme.colors.neutral[900],
    },
    image: {
      backgroundColor: theme.colors.neutral[200],
    },
    violationContainer: {
      backgroundColor: theme.colors.neutral[200],
    },
    violationText: {
      color: theme.colors.neutral[600],
    },
    metaText: {
      color: theme.colors.neutral[500],
    },
    notesLabel: {
      color: theme.colors.neutral[400],
    },
    notesText: {
      color: theme.colors.neutral[700],
    },
    errorContainer: {
      backgroundColor: theme.colors.neutral[100],
    },
    errorTitle: {
      color: theme.colors.neutral[900],
    },
    errorText: {
      color: theme.colors.neutral[600],
    },
  });

  const renderSkeletonItem = () => (
    <Card style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <Skeleton width={120} height={20} />
        <Skeleton width={80} height={16} />
      </View>
      <View style={styles.skeletonBody}>
        <Skeleton width={80} height={80} borderRadius={baseTheme.radius.sm} />
        <View style={styles.skeletonTextCol}>
          <Skeleton width="100%" height={16} />
          <Skeleton width="80%" height={16} />
          <Skeleton width="50%" height={14} />
        </View>
      </View>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, dynamicStyles.loadingContainer]}>
        <FlashList
          data={[1, 2, 3]}
          renderItem={renderSkeletonItem}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={[styles.list, dynamicStyles.list]}
          scrollEnabled={false}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, dynamicStyles.errorContainer]}>
        <AlertTriangle size={48} color={theme.colors.status.rejected} style={styles.errorIcon} accessibilityLabel="Error alert icon" />
        <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>Sync Failed</Text>
        <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
        <Button
          title="Retry Loading"
          onPress={() => loadSubmissions()}
          variant="primary"
          style={styles.retryButton}
        />
      </View>
    );
  }

  return (
    <FlashList
      contentContainerStyle={[styles.list, dynamicStyles.list]}
      data={submissions}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      ListHeaderComponent={
        digest ? (
          <Card style={{ backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: '#818CF8', borderWidth: 1, padding: 14, marginBottom: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#6366F1" />
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#C7D2FE' : '#4338CA' }}>
                  Smart Activity Digest
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: isDark ? '#A5B4FC' : '#6366F1', fontWeight: '600' }}>
                {digest.ward_name}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: isDark ? '#E0E7FF' : '#312E81', lineHeight: 18, fontWeight: '500' }}>
              {digest.summary_text}
            </Text>
            {digest.badge_msg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: isDark ? '#818CF8' : '#4F46E5', fontWeight: '700' }}>
                  🏆 {digest.badge_msg}
                </Text>
              </View>
            )}
          </Card>
        ) : null
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={[styles.cardHeader, dynamicStyles.cardHeader]}>
            <View style={styles.categoryRow}>
              <Text style={[styles.categoryText, dynamicStyles.categoryText]}>
                {item.mission_type.charAt(0).toUpperCase() + item.mission_type.slice(1)}
              </Text>
            </View>
            <StatusBadge status={item.status} size="small" />
          </View>

          <View style={styles.cardContent}>
            {item.flags && item.flags.includes('auto_rejected_content_policy') ? (
              <View style={[styles.image, styles.violationContainer, dynamicStyles.violationContainer]}>
                <Text style={[styles.violationText, dynamicStyles.violationText]}>This submission violated content guidelines</Text>
              </View>
            ) : (
              <Image source={{ uri: item.photo_url }} style={[styles.image, dynamicStyles.image]} accessibilityLabel="Submission report photo" />
            )}
            <View style={styles.detailsCol}>
              <View style={styles.metaRow}>
                <Calendar size={14} color={theme.colors.neutral[500]} accessibilityLabel="Date calendar icon" />
                <Text style={[styles.metaText, dynamicStyles.metaText]}>
                  {new Date(item.captured_at).toLocaleDateString()} at{' '}
                  {new Date(item.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              
              <View style={styles.metaRow}>
                <MapPin size={14} color={theme.colors.neutral[500]} accessibilityLabel="Location Pin icon" />
                <Text style={[styles.metaText, dynamicStyles.metaText]} numberOfLines={1}>
                  Lat {item.latitude.toFixed(5)}, Lon {item.longitude.toFixed(5)}
                </Text>
              </View>

              <Text style={[styles.notesLabel, dynamicStyles.notesLabel]}>Reporter Notes</Text>
              <Text style={[styles.notesText, dynamicStyles.notesText]} numberOfLines={2}>
                {item.notes || 'No description provided.'}
              </Text>
            </View>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No reports submitted yet"
            description="All civic issues you capture and report from this device will be compiled and displayed here."
            icon={<Inbox size={48} color={theme.colors.neutral[400]} accessibilityLabel="Inbox icon" />}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
  },
  list: {
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
    flexGrow: 1,
    paddingBottom: 40,
  },
  card: {
    gap: baseTheme.spacing[12],
    padding: baseTheme.spacing[16],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: baseTheme.spacing[8],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  cardContent: {
    flexDirection: 'row',
    gap: baseTheme.spacing[12],
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: baseTheme.radius.sm,
  },
  violationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[8],
  },
  violationText: {
    fontSize: 9,
    fontWeight: baseTheme.typography.fontWeights.bold,
    textAlign: 'center',
  },
  detailsCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.medium,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: baseTheme.typography.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  notesText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[32],
  },
  errorIcon: {
    marginBottom: baseTheme.spacing[16],
  },
  errorTitle: {
    fontSize: baseTheme.typography.fontSizes.lg,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[8],
  },
  errorText: {
    fontSize: baseTheme.typography.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: baseTheme.spacing[24],
  },
  retryButton: {
    width: '100%',
    maxWidth: 200,
  },

  // Skeletons
  skeletonCard: {
    padding: baseTheme.spacing[16],
    marginBottom: baseTheme.spacing[12],
    gap: baseTheme.spacing[12],
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBody: {
    flexDirection: 'row',
    gap: baseTheme.spacing[12],
  },
  skeletonTextCol: {
    flex: 1,
    gap: 8,
  },
});
