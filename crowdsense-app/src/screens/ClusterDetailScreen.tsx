import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Send,
  Flag,
  Shield,
  UserCheck,
  UserX,
  Share2,
} from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';
import { StatusTimeline } from '../components/StatusTimeline';
import { useTheme } from '../theme/ThemeContext';
import { getUserSession } from '../services/auth';
import { triggerContextualStoreReview } from '../services/storeReview';

interface ClusterDetailScreenProps {
  clusterId: string;
  onBack?: () => void;
  onShareImpact?: (clusterData: any) => void;
}

interface CommentItem {
  id: string;
  cluster_id: string;
  user_id?: string | null;
  author_name: string;
  body: string;
  is_anonymous: boolean;
  flag_count?: number;
  created_at: string;
}

export default function ClusterDetailScreen({
  clusterId,
  onBack,
  onShareImpact,
}: ClusterDetailScreenProps) {
  const { theme } = useTheme();
  const [cluster, setCluster] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // New Comment state
  const [commentText, setCommentText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadClusterData = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const eventsData = await apiFetch(`/clusters/${clusterId}/events`);
        setEvents(eventsData || []);

        const commentsData = await apiFetch(`/clusters/${clusterId}/comments`).catch(() => []);
        setComments(commentsData || []);

        const status = eventsData?.length > 0 ? eventsData[eventsData.length - 1].status : 'active';
        setCluster({
          id: clusterId,
          status,
          mission_type: eventsData?.[0]?.mission_type || 'pothole',
        });

        // Trigger store review prompt if cluster is resolved
        if (status === 'resolved') {
          triggerContextualStoreReview('report_resolved');
        }
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    if (clusterId) loadClusterData();
  }, [clusterId]);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      const session = await getUserSession();
      const payload = {
        body: commentText.trim(),
        user_id: session?.userId || null,
        author_name: session ? 'Verified Reporter' : 'Civic Resident',
        is_anonymous: isAnonymous,
      };

      const newComment = await apiFetch(`/clusters/${clusterId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      Toast.show({
        type: 'success',
        text1: 'Comment Posted',
        text2: 'Thank you for adding local context to this cluster.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could Not Post Comment',
        text2: err?.message || 'Check for abusive language or try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlagComment = (commentId: string) => {
    Alert.alert(
      'Flag Comment',
      'Report this comment for violating civic community guidelines?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Abuse',
          style: 'destructive',
          onPress: async () => {
            try {
              const session = await getUserSession();
              await apiFetch(`/comments/${commentId}/flag`, {
                method: 'POST',
                body: JSON.stringify({
                  reason: 'offensive',
                  reporter_user_id: session?.userId || null,
                }),
              });
              Toast.show({
                type: 'success',
                text1: 'Flag Submitted',
                text2: 'Our moderation team will review this comment.',
              });
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Could not flag comment.',
              });
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading cluster audit trail & discussions...</Text>
      </View>
    );
  }

  if (notFound || !cluster) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color="#DC2626" />
        <Text style={styles.notFoundTitle}>Cluster Not Found</Text>
        <Text style={styles.notFoundSubtitle}>
          This report cluster may have been resolved, deleted, or merged by moderators.
        </Text>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Return to Map</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBackHeader}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backTouch}>
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Cluster #{clusterId.slice(0, 8)}</Text>
          <Text style={styles.headerSubtitle}>Verified Civic Audit Trail & Discussion</Text>
        </View>
        {onShareImpact && (
          <Pressable
            onPress={() => onShareImpact(cluster)}
            style={styles.shareHeaderBtn}
          >
            <Share2 size={16} color="#4F46E5" />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        )}
      </View>

      {/* Status Timeline */}
      <StatusTimeline currentStatus={cluster.status} events={events} />

      {/* Discussion Thread Section */}
      <View style={styles.discussionSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.iconCircle}>
            <MessageSquare size={18} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.discussionSectionTitle}>Community Discussion</Text>
            <Text style={styles.discussionSectionSubtitle}>
              Add local context without filing duplicate reports
            </Text>
          </View>
          <View style={styles.commentCountBadge}>
            <Text style={styles.commentCountText}>{comments.length}</Text>
          </View>
        </View>

        {/* Comments List */}
        {comments.length === 0 ? (
          <View style={styles.emptyCommentsCard}>
            <MessageSquare size={28} color="#94A3B8" />
            <Text style={styles.emptyCommentsText}>
              No comments yet. Be the first neighbor to add context (e.g., "saw repair crew today" or "still flooded")!
            </Text>
          </View>
        ) : (
          <View style={styles.commentsList}>
            {comments.map((comment) => (
              <View key={comment.id} style={styles.commentBubble}>
                <View style={styles.commentHeaderRow}>
                  <View style={styles.authorBadgeRow}>
                    {comment.is_anonymous ? (
                      <UserX size={14} color="#64748B" />
                    ) : (
                      <UserCheck size={14} color="#2563EB" />
                    )}
                    <Text
                      style={[
                        styles.authorNameText,
                        comment.is_anonymous && styles.anonymousAuthor,
                      ]}
                    >
                      {comment.author_name}
                    </Text>
                  </View>
                  <View style={styles.commentMetaRight}>
                    <Text style={styles.commentTime}>
                      {new Date(comment.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Pressable
                      onPress={() => handleFlagComment(comment.id)}
                      style={styles.flagButton}
                    >
                      <Flag size={12} color="#94A3B8" />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.commentBodyText}>{comment.body}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Post Comment Input Box */}
        <View style={styles.newCommentBox}>
          <TextInput
            style={styles.textInput}
            placeholder="Add update or context on this issue..."
            placeholderTextColor="#94A3B8"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
          />
          <View style={styles.commentActionsRow}>
            <View style={styles.anonToggleRow}>
              <Shield size={14} color={isAnonymous ? '#4F46E5' : '#64748B'} />
              <Text style={styles.anonLabel}>Post Anonymously</Text>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: '#CBD5E1', true: '#C7D2FE' }}
                thumbColor={isAnonymous ? '#4F46E5' : '#94A3B8'}
              />
            </View>

            <Pressable
              onPress={handlePostComment}
              disabled={isSubmitting || !commentText.trim()}
              style={[
                styles.sendButton,
                (!commentText.trim() || isSubmitting) && styles.sendButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={14} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 12,
  },
  notFoundSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  topBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  backTouch: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  shareHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  discussionSection: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  discussionSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  commentCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  commentCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  emptyCommentsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 8,
  },
  emptyCommentsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  commentsList: {
    gap: 10,
    marginBottom: 16,
  },
  commentBubble: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  authorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  anonymousAuthor: {
    color: '#64748B',
    fontStyle: 'italic',
  },
  commentMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  flagButton: {
    padding: 3,
  },
  commentBodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  newCommentBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  commentActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  anonToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anonLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
