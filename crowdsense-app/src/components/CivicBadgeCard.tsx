import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Award, ShieldCheck, Zap, Heart, Eye, Check } from 'lucide-react-native';

export interface CivicBadgeProps {
  id: string;
  title: string;
  category: 'reporter' | 'validator' | 'pioneer' | 'advocate';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  currentCount: number;
  targetCount: number;
  unlocked: boolean;
  onPress?: () => void;
}

const TIER_COLORS = {
  bronze: { bg: '#451A03', border: '#B45309', text: '#FDE68A', badge: '#D97706' },
  silver: { bg: '#1E293B', border: '#64748B', text: '#E2E8F0', badge: '#94A3B8' },
  gold: { bg: '#422006', border: '#EAB308', text: '#FEF08A', badge: '#CA8A04' },
  platinum: { bg: '#172554', border: '#3B82F6', text: '#BFDBFE', badge: '#2563EB' },
};

export default function CivicBadgeCard({
  title,
  category,
  tier,
  currentCount,
  targetCount,
  unlocked,
  onPress,
}: CivicBadgeProps) {
  const scheme = TIER_COLORS[tier] || TIER_COLORS.bronze;
  const progressPct = Math.min(100, Math.round((currentCount / targetCount) * 100));

  const renderIcon = () => {
    switch (category) {
      case 'reporter':
        return <Zap color={scheme.badge} size={24} />;
      case 'validator':
        return <ShieldCheck color={scheme.badge} size={24} />;
      case 'advocate':
        return <Heart color={scheme.badge} size={24} />;
      default:
        return <Award color={scheme.badge} size={24} />;
    }
  };

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: scheme.bg, borderColor: scheme.border },
        !unlocked && styles.cardLocked,
      ]}
      onPress={onPress}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrapper, { borderColor: scheme.border }]}>
          {renderIcon()}
        </View>
        <View style={styles.titleArea}>
          <Text style={[styles.title, { color: scheme.text }]}>{title}</Text>
          <Text style={styles.tierTag}>{tier.toUpperCase()} TIER</Text>
        </View>
        {unlocked && (
          <View style={styles.unlockedTag}>
            <Check color="#22C55E" size={14} />
            <Text style={styles.unlockedText}>Earned</Text>
          </View>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>
            {currentCount} / {targetCount} missions
          </Text>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPct}%`, backgroundColor: scheme.badge },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  cardLocked: {
    opacity: 0.75,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  titleArea: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  tierTag: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  unlockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14532D',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  unlockedText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  progressPct: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
