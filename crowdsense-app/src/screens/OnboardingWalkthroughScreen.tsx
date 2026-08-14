import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  Dimensions,
} from 'react-native';
import { MapPin, Camera, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../components';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge: string;
}

const SLIDES: Slide[] = [
  {
    id: 'slide_1',
    icon: MapPin,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    title: 'See Civic Issues Near You',
    subtitle: 'Explore real-time map clusters for potholes, garbage, broken streetlights, and power outages in your ward.',
    badge: '100% Transparent Map',
  },
  {
    id: 'slide_2',
    icon: Camera,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    title: 'Report Issues in 10 Seconds',
    subtitle: 'Snap a quick photo or record a voice note in your native language. We pHash check and auto-cluster reports.',
    badge: 'Photo & Voice Capture',
  },
  {
    id: 'slide_3',
    icon: CheckCircle2,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    title: 'Watch It Get Fixed',
    subtitle: 'Track live status from dispatch to municipal repair. Upvote neighbor reports to accelerate municipal action.',
    badge: 'Direct Municipal Dispatch',
  },
];

interface OnboardingWalkthroughScreenProps {
  onComplete: () => void;
}

export default function OnboardingWalkthroughScreen({ onComplete }: OnboardingWalkthroughScreenProps) {
  const { theme } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const slide = SLIDES[activeIndex];
  const IconComponent = slide.icon;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.neutral[50] }]}>
      {/* Header Skip */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <ShieldCheck size={24} color={theme.colors.primaryVibrant} />
          <Text style={[styles.brandText, { color: theme.colors.primary }]}>CrowdSense</Text>
        </View>
        <Pressable onPress={onComplete} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: theme.colors.neutral[500] }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Main Slide Content */}
      <View style={styles.slideContainer}>
        <View style={[styles.badgePill, { backgroundColor: slide.iconBg }]}>
          <Text style={[styles.badgeText, { color: slide.iconColor }]}>{slide.badge}</Text>
        </View>

        <View style={[styles.iconBox, { backgroundColor: slide.iconBg }]}>
          <IconComponent size={64} color={slide.iconColor} />
        </View>

        <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>{slide.title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.neutral[600] }]}>{slide.subtitle}</Text>

        {/* Slide Indicator Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? theme.colors.primaryVibrant : theme.colors.neutral[300],
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Footer Action */}
      <View style={styles.footer}>
        <Button
          title={activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="vibrant"
          icon={<ArrowRight size={20} color="#FFFFFF" />}
          style={{ width: '100%' }}
        />
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
});
