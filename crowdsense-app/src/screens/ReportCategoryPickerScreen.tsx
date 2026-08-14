import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  Cone,
  Accessibility,
  ShieldAlert,
  Zap,
  ChevronRight,
  X,
  Camera,
  Mic,
} from 'lucide-react-native';

import { t } from '../config/i18n';

export interface CategoryOption {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  badge?: string;
}

interface ReportCategoryPickerScreenProps {
  onSelectCategory: (categoryId: string) => void;
  onClose: () => void;
}

export default function ReportCategoryPickerScreen({
  onSelectCategory,
  onClose,
}: ReportCategoryPickerScreenProps) {
  const CATEGORIES: CategoryOption[] = [
    {
      id: 'standard',
      title: t('standardReportTitle'),
      subtitle: t('standardReportSub'),
      icon: Cone,
      color: '#EA580C',
    },
    {
      id: 'accessibility',
      title: t('accessibilityTitle'),
      subtitle: t('accessibilitySub'),
      icon: Accessibility,
      color: '#2563EB',
      badge: 'NGO Export',
    },
    {
      id: 'safety_concern',
      title: t('safetyTitle'),
      subtitle: t('safetySub'),
      icon: ShieldAlert,
      color: '#DB2777',
      badge: 'Anonymous',
    },
    {
      id: 'utility_outage',
      title: t('utilityTitle'),
      subtitle: t('utilitySub'),
      icon: Zap,
      color: '#059669',
      badge: 'Fast',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('fileReportTitle')}</Text>
          <Text style={styles.subtitle}>{t('selectCategory')}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <X size={20} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {CATEGORIES.map((cat) => {
          const IconComp = cat.icon;
          return (
            <Pressable
              key={cat.id}
              style={styles.card}
              onPress={() => onSelectCategory(cat.id)}
            >
              <View style={[styles.iconBox, { backgroundColor: `${cat.color}15` }]}>
                <IconComp size={24} color={cat.color} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{cat.title}</Text>
                  {cat.badge && (
                    <View style={[styles.badge, { backgroundColor: `${cat.color}15` }]}>
                      <Text style={[styles.badgeText, { color: cat.color }]}>{cat.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle}>{cat.subtitle}</Text>
              </View>

              <ChevronRight size={20} color="#94A3B8" />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
