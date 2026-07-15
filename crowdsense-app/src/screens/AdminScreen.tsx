import React, { useEffect, useState, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  ShieldCheck,
  MapPin,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import type { Submission } from '../types';
import { fetchPendingSubmissions, updateSubmissionStatus } from '../services/submissions';
import { Card, Badge, Skeleton, EmptyState, Button } from '../components';

export default function AdminScreen() {
  const { theme, isDark } = useTheme();
  const [pending, setPending] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const rows = await fetchPendingSubmissions();
      // Sort by captured date descending
      const sorted = rows.sort(
        (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      );
      setPending(sorted);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to sync pending queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadPending(true);
  };

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessingId(id);
    
    // Satisfying haptics on action
    if (decision === 'approved') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    try {
      await updateSubmissionStatus(id, decision);
      setPending((p) => p.filter((s) => s.id !== id));
      
      Toast.show({
        type: 'success',
        text1: `Submission ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        text2: `Successfully updated report status.`,
      });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: err?.message || 'Could not save action to server.',
      });
    } finally {
      setProcessingId(null);
    }
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
    typeText: {
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
    notesContainer: {
      backgroundColor: theme.colors.neutral[100],
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
      <Skeleton width={110} height={110} borderRadius={baseTheme.radius.sm} />
      <View style={styles.skeletonBody}>
        <Skeleton width={120} height={16} />
        <Skeleton width={80} height={14} />
        <Skeleton width={90} height={20} borderRadius={6} />
        <View style={styles.skeletonButtons}>
          <Skeleton width="45%" height={36} borderRadius={baseTheme.radius.sm} />
          <Skeleton width="45%" height={36} borderRadius={baseTheme.radius.sm} />
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
        <AlertCircle size={48} color={theme.colors.status.rejected} style={styles.errorIcon} accessibilityLabel="Alert notification icon" />
        <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>Connection Error</Text>
        <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
        <Button
          title="Retry Connection"
          onPress={() => loadPending()}
          variant="primary"
          style={styles.retryButton}
        />
      </View>
    );
  }

  return (
    <FlashList
      data={pending}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, dynamicStyles.list]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <EmptyState
            title="All caught up!"
            description="There are currently no civic reports in the pending queue awaiting review."
            icon={<ShieldCheck size={48} color={theme.colors.status.approved} accessibilityLabel="Shield check status icon" />}
          />
        </View>
      }
      renderItem={({ item }) => {
        // Calculate trust score representation
        const score = item.trust_score !== undefined 
          ? item.trust_score 
          : item.devices?.trust_score;
        const hasScore = score !== undefined;
        const displayScore = hasScore ? score : 0.5;
        const percent = Math.round(displayScore * 100);
        
        let trustVariant: 'approved' | 'pending' | 'rejected' = 'pending';
        let TrustIcon = Info;
        if (displayScore >= 0.75) {
          trustVariant = 'approved';
          TrustIcon = TrendingUp;
        } else if (displayScore <= 0.4) {
          trustVariant = 'rejected';
          TrustIcon = TrendingDown;
        }

        return (
          <Card style={styles.card}>
            <View style={[styles.cardHeader, dynamicStyles.cardHeader]}>
              <Text style={[styles.typeText, dynamicStyles.typeText]}>
                {item.mission_type.charAt(0).toUpperCase() + item.mission_type.slice(1)}
              </Text>
              <Badge
                label={`Trust: ${percent}% ${!hasScore ? '(New)' : ''}`}
                variant={trustVariant}
              />
            </View>

            <View style={styles.cardContent}>
              {item.flags && item.flags.includes('auto_rejected_content_policy') ? (
                <View style={[styles.image, styles.violationContainer, dynamicStyles.violationContainer]}>
                  <Text style={[styles.violationText, dynamicStyles.violationText]}>This submission violated content guidelines</Text>
                </View>
              ) : (
                <Image source={{ uri: item.photo_url }} style={[styles.image, dynamicStyles.image]} accessibilityLabel="Submission photo" />
              )}
              
              <View style={styles.bodyCol}>
                <View style={styles.metaRow}>
                  <MapPin size={12} color={theme.colors.neutral[500]} accessibilityLabel="Map pin icon" />
                  <Text style={[styles.metaText, dynamicStyles.metaText]} numberOfLines={1}>
                    Lat {item.latitude.toFixed(5)}, Lon {item.longitude.toFixed(5)}
                  </Text>
                </View>
                
                <View style={styles.metaRow}>
                  <Calendar size={12} color={theme.colors.neutral[500]} accessibilityLabel="Date calendar icon" />
                  <Text style={[styles.metaText, dynamicStyles.metaText]}>
                    {new Date(item.captured_at).toLocaleDateString()}
                  </Text>
                </View>

                {item.notes ? (
                  <View style={[styles.notesContainer, dynamicStyles.notesContainer]}>
                    <Text style={[styles.notesText, dynamicStyles.notesText]} numberOfLines={2}>
                      "{item.notes}"
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    title="Approve"
                    onPress={() => handleDecision(item.id, 'approved')}
                    disabled={processingId !== null}
                    style={styles.actionButton}
                    textStyle={styles.actionButtonText}
                  />
                  <Button
                    title="Reject"
                    variant="danger"
                    onPress={() => handleDecision(item.id, 'rejected')}
                    disabled={processingId !== null}
                    style={styles.actionButton}
                    textStyle={styles.actionButtonText}
                  />
                </View>
              </View>
            </View>
          </Card>
        );
      }}
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
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[12],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: baseTheme.spacing[8],
  },
  typeText: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  cardContent: {
    flexDirection: 'row',
    gap: baseTheme.spacing[16],
  },
  image: {
    width: 110,
    height: 110,
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
  bodyCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  metaText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.semibold,
  },
  notesContainer: {
    padding: baseTheme.spacing[8],
    borderRadius: baseTheme.radius.sm,
    marginVertical: 4,
  },
  notesText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: baseTheme.spacing[8],
    marginTop: baseTheme.spacing[8],
  },
  actionButton: {
    flex: 1,
    height: 44, // 44px touch target height
    paddingHorizontal: 0,
  },
  actionButtonText: {
    fontSize: 12,
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
    flexDirection: 'row',
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
