import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * CampaignBanner — Part 3: Seasonal / Event-Based Campaign Banners
 *
 * PRECONDITION GATE: The API returns an empty campaigns list until
 * FUTURE_BACKLOG.md Part 3 precondition is met (12 months of data).
 * This component handles that gracefully — it simply renders nothing
 * when there are no active campaigns.
 *
 * Design rules:
 *  - Dismissible banner only — never a full-screen takeover.
 *  - Full-screen takeovers are reserved for the HazardAlertTakeoverModal.
 *  - Dismissed campaigns are remembered per-device via AsyncStorage.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const DISMISSED_KEY = 'dismissed_campaigns_v1';

interface Campaign {
  id: string;
  title: string;
  body: string;
  cta_deep_link?: string;
  category_filter?: string;
  is_dismissible: boolean;
}

interface Props {
  /** Current user's active category context, used to filter relevant campaigns */
  activeCategory?: string;
}

export default function CampaignBanner({ activeCategory }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-120)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const fetchCampaign = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      const res = await fetch(`${API_BASE}/campaigns/active?${params.toString()}`);
      if (!res.ok) return; // 503 or network error — silently skip
      const data = await res.json();
      if (!data.campaigns?.length) return;

      // Filter out already-dismissed campaigns
      const rawDismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      const dismissed: string[] = rawDismissed ? JSON.parse(rawDismissed) : [];
      const eligible = data.campaigns.filter((c: Campaign) => !dismissed.includes(c.id));
      if (!eligible.length) return;

      setCampaign(eligible[0]);
      setVisible(true);
    } catch {
      // Network errors are silent — banners are not critical path
    }
  }, [activeCategory]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -120, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  const handleDismiss = async () => {
    if (!campaign) return;
    setVisible(false);
    // Persist dismissal so it doesn't reappear this session
    const rawDismissed = await AsyncStorage.getItem(DISMISSED_KEY);
    const dismissed: string[] = rawDismissed ? JSON.parse(rawDismissed) : [];
    dismissed.push(campaign.id);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  };

  const handleCTA = () => {
    if (campaign?.cta_deep_link) {
      Linking.openURL(campaign.cta_deep_link).catch(() => {});
    }
    handleDismiss();
  };

  if (!campaign) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}
      accessibilityRole="banner"
      accessibilityLabel={`Campaign: ${campaign.title}`}
    >
      {/* Accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>{campaign.title}</Text>
          <Text style={styles.body} numberOfLines={3}>{campaign.body}</Text>
        </View>

        <View style={styles.actions}>
          {campaign.cta_deep_link && (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleCTA} accessibilityRole="button">
              <Text style={styles.ctaText}>Report now →</Text>
            </TouchableOpacity>
          )}
          {campaign.is_dismissible && (
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss campaign banner"
            >
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,                  // Below HazardAlertTakeoverModal (z:100) intentionally
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#252550',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    backgroundColor: '#6C63FF',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  textBlock: { flex: 1 },
  title: {
    color: '#E8E8F0',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  body: {
    color: '#9898C0',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 8,
  },
  dismissText: {
    color: '#666',
    fontSize: 16,
    lineHeight: 16,
  },
});
