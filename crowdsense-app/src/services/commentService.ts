import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export interface ClusterComment {
  id: string;
  cluster_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  is_anonymous: boolean;
  is_flagged: boolean;
  flag_count: number;
  upvotes: number;
  status: 'ACTIVE' | 'FLAGGED' | 'HIDDEN' | 'REMOVED';
  pii_redacted?: boolean;
  created_at: string;
  updated_at: string;
}

const COMMENTS_CACHE_PREFIX = '@crowdsense_comments_';

export async function fetchClusterComments(clusterId: string): Promise<ClusterComment[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/comments/${clusterId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.setItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn(`[commentService] Network error fetching comments for ${clusterId}, checking local cache:`, err);
  }

  // Fallback to local cache
  const cached = await AsyncStorage.getItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }
  return [];
}

export async function postClusterComment(
  clusterId: string,
  body: string,
  authorName: string = 'Resident',
  userId?: string,
  isAnonymous: boolean = false,
  clusterCategory?: string
): Promise<ClusterComment> {
  const payload = {
    body,
    author_name: authorName,
    user_id: userId,
    is_anonymous: isAnonymous,
    cluster_category: clusterCategory,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/comments/${clusterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const newComment: ClusterComment = await res.json();
      // Update cache
      const cached = await fetchClusterComments(clusterId);
      const updated = [newComment, ...cached.filter((c) => c.id !== newComment.id)];
      await AsyncStorage.setItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`, JSON.stringify(updated));
      return newComment;
    }
    const errData = await res.json().catch(() => ({ detail: 'Failed to post comment' }));
    throw new Error(errData.detail || 'Failed to post comment');
  } catch (err: any) {
    // Offline optimistic fallback
    const offlineComment: ClusterComment = {
      id: `local-${Date.now()}`,
      cluster_id: clusterId,
      user_id: isAnonymous ? null : (userId || null),
      author_name: isAnonymous ? 'Anonymous Resident' : authorName,
      body: body,
      is_anonymous: isAnonymous,
      is_flagged: false,
      flag_count: 0,
      upvotes: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const cached = await fetchClusterComments(clusterId);
    await AsyncStorage.setItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`, JSON.stringify([offlineComment, ...cached]));
    return offlineComment;
  }
}

export async function upvoteComment(clusterId: string, commentId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/comments/${clusterId}/${commentId}/upvote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.warn('[commentService] Network error upvoting comment:', err);
  }

  // Update local cache optimistically
  const cached = await fetchClusterComments(clusterId);
  const updated = cached.map((c) => (c.id === commentId ? { ...c, upvotes: c.upvotes + 1 } : c));
  await AsyncStorage.setItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`, JSON.stringify(updated));
}

export async function flagComment(clusterId: string, commentId: string, reason: string = 'inappropriate'): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/comments/${clusterId}/${commentId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    console.warn('[commentService] Network error flagging comment:', err);
  }

  // Update local cache optimistically
  const cached = await fetchClusterComments(clusterId);
  const updated = cached.map((c) => {
    if (c.id === commentId) {
      const newFlags = c.flag_count + 1;
      return {
        ...c,
        flag_count: newFlags,
        is_flagged: true,
        status: newFlags >= 3 ? ('HIDDEN' as const) : c.status,
      };
    }
    return c;
  });
  await AsyncStorage.setItem(`${COMMENTS_CACHE_PREFIX}${clusterId}`, JSON.stringify(updated));
}
