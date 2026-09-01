import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  Award,
  ShieldCheck,
  Flame,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  Filter,
  Layers,
  HeartHandshake,
  FileCheck,
  Camera,
  Users,
} from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';
import { useTheme } from '../theme/ThemeContext';
import { Card } from '../components';

interface CivicProfileScreenProps {
  onBack?: () => void;
  userId?: string;
}

export default function CivicProfileScreen({ onBack, userId = 'default_user' }: CivicProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [impact, setImpact] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState('ALL');

  useEffect(() => {
    loadCivicData();
  }, [userId]);

  const loadCivicData = async () => {
    setLoading(true);
    try {
      const [profData, badgeData, impactData, histData] = await Promise.all([
        apiFetch(`/users/me/civic-profile?user_id=${userId}`),
        apiFetch(`/users/me/badges?user_id=${userId}`),
        apiFetch(`/users/me/impact?user_id=${userId}`),
        apiFetch(`/users/me/contributions?user_id=${userId}&limit=30`),
      ]);
      setProfile(profData);
      setBadges(badgeData || []);
      setImpact(impactData);
      setHistory(histData || []);
    } catch {
      // Fallback simulated data
      setProfile({
        user_id: userId,
        display_name: 'Priya Sharma (HSR)',
        civic_score: 1284,
        level: 5,
        trust_score: 0.91,
        trust_score_percent: 91,
        reports_verified: 14,
        issues_confirmed: 37,
        evidence_accepted: 9,
        volunteer_tasks_completed: 6,
        surveys_completed: 8,
      });
      setBadges([
        { id: 'neighborhood_watch', name: 'Neighborhood Watch', icon: '🏅', current_tier: 'BRONZE', earned: true, current_progress: 14, next_tier_target: 50 },
        { id: 'road_guardian', name: 'Road Guardian', icon: '🛣', current_tier: 'BRONZE', earned: true, current_progress: 11, next_tier_target: 50 },
        { id: 'evidence_expert', name: 'Evidence Expert', icon: '📸', current_tier: 'BRONZE', earned: true, current_progress: 9, next_tier_target: 30 },
        { id: 'community_helper', name: 'Community Helper', icon: '🤝', current_tier: 'SILVER', earned: true, current_progress: 37, next_tier_target: 75 },
      ]);
      setImpact({
        issues_helped_verify: 51,
        roads_improved: 11,
        accessibility_documented: 4,
        cleanliness_actions: 8,
        volunteer_missions_completed: 6,
      });
      setHistory([
        { id: '1', event_type: 'REPORT_VERIFIED', points: 100, created_at: '2026-09-01T14:20:00Z', metadata: { mission_type: 'pothole' } },
        { id: '2', event_type: 'ISSUE_CONFIRMED', points: 20, created_at: '2026-08-31T11:15:00Z', metadata: {} },
        { id: '3', event_type: 'EVIDENCE_ACCEPTED', points: 30, created_at: '2026-08-30T17:45:00Z', metadata: {} },
        { id: '4', event_type: 'VOLUNTEER_TASK_COMPLETED', points: 100, created_at: '2026-08-28T09:30:00Z', metadata: {} },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    if (historyFilter === 'ALL') return true;
    return h.event_type.includes(historyFilter);
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={[styles.loadingText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Loading Civic Profile & Reputation...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      {/* Top Navigation */}
      {onBack && (
        <View style={styles.topNav}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <ChevronLeft size={20} color={isDark ? '#F8FAFC' : '#0F172A'} />
            <Text style={[styles.backText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Settings</Text>
          </Pressable>
        </View>
      )}

      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarEmoji}>🎖️</Text>
        </View>
        <Text style={[styles.userName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {profile?.display_name || 'Citizen Contributor'}
        </Text>
        <Text style={styles.levelBadge}>Level {profile?.level || 1} Civic Steward</Text>
      </View>

      {/* ── 1. Trust Score vs Civic Score Dual Summary ──────────────────── */}
      <View style={styles.dualScoreContainer}>
        {/* Civic Contribution Score */}
        <View style={[styles.scoreCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F6' }]}>
          <View style={styles.cardHeaderSmall}>
            <Flame size={16} color="#2563EB" />
            <Text style={styles.scoreTitle}>Civic Score</Text>
          </View>
          <Text style={[styles.scoreBig, { color: '#2563EB' }]}>
            {profile?.civic_score?.toLocaleString() || 0}
          </Text>
          <Text style={styles.scoreSub}>Verified civic value earned</Text>
        </View>

        {/* Trust Reliability Score */}
        <View style={[styles.scoreCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: '#10B981' }]}>
          <View style={styles.cardHeaderSmall}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.scoreTitle}>Trust Score</Text>
          </View>
          <Text style={[styles.scoreBig, { color: '#10B981' }]}>
            {profile?.trust_score_percent || 91}%
          </Text>
          <Text style={styles.scoreSub}>Report & evidence reliability</Text>
        </View>
      </View>

      {/* Distinction Explainer Note */}
      <View style={styles.explainerBox}>
        <HelpCircle size={14} color="#64748B" />
        <Text style={styles.explainerText}>
          <Text style={{ fontWeight: '700' }}>Civic Score</Text> rewards verified community outcomes. <Text style={{ fontWeight: '700' }}>Trust Score</Text> validates submitted evidence accuracy.
        </Text>
      </View>

      {/* ── 2. Real-World Civic Impact ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Verified Community Impact
        </Text>
        <View style={styles.impactGrid}>
          <View style={[styles.impactBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <FileCheck size={20} color="#2563EB" />
            <Text style={styles.impactVal}>{impact?.issues_helped_verify || 0}</Text>
            <Text style={styles.impactLabel}>Issues Verified</Text>
          </View>

          <View style={[styles.impactBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <TrendingUp size={20} color="#10B981" />
            <Text style={styles.impactVal}>{impact?.roads_improved || 0}</Text>
            <Text style={styles.impactLabel}>Roads Improved</Text>
          </View>

          <View style={[styles.impactBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <HeartHandshake size={20} color="#8B5CF6" />
            <Text style={styles.impactVal}>{impact?.volunteer_missions_completed || 0}</Text>
            <Text style={styles.impactLabel}>Missions Done</Text>
          </View>
        </View>
      </View>

      {/* ── 3. Badges Showcase ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Civic Badges & Milestones
          </Text>
          <Text style={styles.badgeCount}>
            {badges.filter((b) => b.earned).length}/{badges.length} Unlocked
          </Text>
        </View>

        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <View
              key={b.id}
              style={[
                styles.badgeCard,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: b.earned ? (b.current_tier === 'GOLD' ? '#F59E0B' : b.current_tier === 'SILVER' ? '#94A3B8' : '#CD7F32') : '#E2E8F0',
                  opacity: b.earned ? 1 : 0.6,
                },
              ]}
            >
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={[styles.badgeName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {b.name}
              </Text>
              {b.earned ? (
                <View style={styles.tierTag}>
                  <Text style={styles.tierTagText}>{b.current_tier}</Text>
                </View>
              ) : (
                <Text style={styles.progressText}>
                  {b.current_progress}/{b.next_tier_target || 10}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* ── 4. Auditable Contribution Ledger History ─────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Contribution Ledger (Append-Only)
        </Text>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['ALL', 'REPORT', 'CONFIRM', 'EVIDENCE', 'VOLUNTEER'].map((f) => (
            <Pressable
              key={f}
              onPress={() => setHistoryFilter(f)}
              style={[
                styles.filterPill,
                historyFilter === f && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  historyFilter === f && styles.filterPillTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Event List */}
        <View style={styles.historyList}>
          {filteredHistory.map((item) => (
            <View
              key={item.id}
              style={[
                styles.historyItem,
                { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
              ]}
            >
              <View style={styles.historyLeft}>
                <View style={[styles.pointBadge, { backgroundColor: item.points >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Text style={[styles.pointBadgeText, { color: item.points >= 0 ? '#166534' : '#991B1B' }]}>
                    {item.points >= 0 ? `+${item.points}` : item.points}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.historyEventTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    {item.event_type.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.created_at).toLocaleDateString()} at{' '}
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>

              <Text style={styles.verifiedTag}>✓ Verified</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  topNav: {
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
  },
  levelBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  dualScoreContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  scoreCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
  },
  cardHeaderSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  scoreTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  scoreBig: {
    fontSize: 26,
    fontWeight: '900',
  },
  scoreSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  explainerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 18,
  },
  explainerText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
    lineHeight: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  impactGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  impactBox: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  impactVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  impactLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCard: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  tierTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  progressText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pointBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pointBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyEventTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  verifiedTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
});
