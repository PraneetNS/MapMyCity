import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import {
  X,
  Share2,
  Sparkles,
  Award,
  ShieldCheck,
  Flame,
  CheckCircle2,
  MapPin,
} from 'lucide-react-native';
import { ImpactCardData, shareImpactCard } from '../services/impactCardGenerator';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 340);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (16 / 9) * 0.9);

interface SocialImpactShareModalProps {
  visible: boolean;
  data: ImpactCardData | null;
  onClose: () => void;
}

export function SocialImpactShareModal({
  visible,
  data,
  onClose,
}: SocialImpactShareModalProps) {
  if (!data) return null;

  const isResolved = data.type === 'resolved_issue';
  const handleShare = async () => {
    await shareImpactCard(data);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#FFFFFF" />
          </Pressable>

          {/* 9:16 Story-formatted Card */}
          <View style={[styles.cardCanvas, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
            {/* Header Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandDot} />
                <Text style={styles.brandTitle}>MapMyCity • CrowdSense</Text>
              </View>
              <Text style={styles.cardTagline}>CITIZEN ACTION REPORT</Text>
            </View>

            {isResolved ? (
              <View style={styles.cardBody}>
                <View style={styles.resolvedBadge}>
                  <Sparkles size={20} color="#FBBF24" />
                  <Text style={styles.resolvedBadgeText}>ISSUE RESOLVED! 🎉</Text>
                </View>

                <Text style={styles.mainTitle}>{data.title}</Text>
                <View style={styles.locationRow}>
                  <MapPin size={14} color="#94A3B8" />
                  <Text style={styles.locationText}>
                    {data.isAnonymous ? 'Bengaluru Ward Area' : data.wardName || 'Bengaluru'}
                  </Text>
                </View>

                {data.beforePhotoUrl && (
                  <View style={styles.photoContainer}>
                    <Image
                      source={{ uri: data.beforePhotoUrl }}
                      style={styles.impactImage}
                      resizeMode="cover"
                    />
                    <View style={styles.verifiedWatermark}>
                      <CheckCircle2 size={14} color="#10B981" />
                      <Text style={styles.watermarkText}>BBMP Municipal Action Verified</Text>
                    </View>
                  </View>
                )}

                <View style={styles.impactFooterNote}>
                  <Text style={styles.impactFooterText}>
                    Reported by vigilant neighbors • Fixed by Municipal Authorities
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.cardBody}>
                <View style={styles.statsBadge}>
                  <Award size={22} color="#F59E0B" />
                  <Text style={styles.statsBadgeText}>MONTHLY CIVIC IMPACT</Text>
                </View>

                <Text style={styles.mainTitle}>Making Our Streets Safer</Text>
                <Text style={styles.subTitle}>Bengaluru East • Top 5% Contributor</Text>

                {/* Big Stat Numbers */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <View style={styles.statIconRow}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text style={styles.statLabel}>Issues Fixed</Text>
                    </View>
                    <Text style={styles.statValue}>{data.stats?.issuesResolved || 5}</Text>
                  </View>

                  <View style={styles.statBox}>
                    <View style={styles.statIconRow}>
                      <ShieldCheck size={16} color="#3B82F6" />
                      <Text style={styles.statLabel}>Trust Score</Text>
                    </View>
                    <Text style={styles.statValue}>{data.stats?.trustScorePercent || 94}%</Text>
                  </View>
                </View>

                <View style={styles.streakBanner}>
                  <Flame size={18} color="#F97316" />
                  <Text style={styles.streakText}>
                    {data.stats?.streakWeeks || 6} Week Active Civic Streak
                  </Text>
                </View>
              </View>
            )}

            {/* Card Footer Banner */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerDomain}>mapmycity.org</Text>
              <Text style={styles.footerCallout}>Join your neighborhood map</Text>
            </View>
          </View>

          {/* Action Row */}
          <Pressable onPress={handleShare} style={styles.shareBtn}>
            <Share2 size={18} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>Share to Instagram / WhatsApp</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    alignItems: 'center',
    gap: 16,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardCanvas: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  cardTagline: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  resolvedBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  statsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  subTitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  photoContainer: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
    position: 'relative',
  },
  impactImage: {
    width: '100%',
    height: '100%',
  },
  verifiedWatermark: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  watermarkText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  impactFooterNote: {
    marginTop: 6,
  },
  impactFooterText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    marginTop: 6,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FB923C',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerDomain: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  footerCallout: {
    fontSize: 10,
    color: '#64748B',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
