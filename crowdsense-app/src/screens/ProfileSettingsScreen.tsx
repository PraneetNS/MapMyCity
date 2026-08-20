import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  User,
  Award,
  Flame,
  ShieldCheck,
  Cpu,
  HardDrive,
  Globe,
  Bell,
  LogOut,
  ChevronRight,
  Sparkles,
  HelpCircle,
} from 'lucide-react-native';
import { getOrInitializeLiteMode, setLiteModeEnabled } from '../services/liteMode';
import { getCacheStorageFootprintMB, clearAppCache } from '../services/cacheManager';
import { INDIAN_LANGUAGES } from './LanguageSelectScreen';
import { FAQHelpModal } from '../components/FAQHelpModal';

interface ProfileSettingsScreenProps {
  onOpenLegalSettings: () => void;
  onChangeLanguage: () => void;
  onLogout: () => void;
  onOpenNotificationCenter?: () => void;
}

export default function ProfileSettingsScreen({
  onOpenLegalSettings,
  onChangeLanguage,
  onLogout,
  onOpenNotificationCenter,
}: ProfileSettingsScreenProps) {
  const [isLiteMode, setIsLiteMode] = useState(false);
  const [cacheMB, setCacheMB] = useState(0.0);
  const [showFAQModal, setShowFAQModal] = useState(false);


  // Notification Preference States
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [notifyHazards, setNotifyHazards] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);

  useEffect(() => {
    getOrInitializeLiteMode().then(setIsLiteMode);
    getCacheStorageFootprintMB().then(setCacheMB);
  }, []);

  const handleToggleLiteMode = async (value: boolean) => {
    setIsLiteMode(value);
    await setLiteModeEnabled(value);
    Toast.show({
      type: 'success',
      text1: value ? 'Lite Mode Enabled' : 'Standard Mode Enabled',
      text2: value ? 'RAM, data, and battery optimizations active.' : 'Full real-time layers active.',
    });
  };

  const handleClearCache = async () => {
    await clearAppCache();
    const newMB = await getCacheStorageFootprintMB();
    setCacheMB(newMB);
    Toast.show({
      type: 'success',
      text1: 'Storage Cache Cleared',
      text2: 'Temporary map files and photo previews removed.',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header & Gamification Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <User size={32} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>Verified Civic Reporter</Text>
            <Text style={styles.userWard}>Bengaluru East • Ward 12</Text>
          </View>
          <View style={styles.badgeBox}>
            <Award size={16} color="#D97706" />
            <Text style={styles.badgeText}>Top 5%</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <ShieldCheck size={16} color="#16A34A" />
              <Text style={styles.statLabel}>Trust Score</Text>
            </View>
            <Text style={styles.statValue}>94%</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Flame size={16} color="#EA580C" />
              <Text style={styles.statLabel}>Action Streak</Text>
            </View>
            <Text style={styles.statValue}>6 Weeks</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Sparkles size={16} color="#2563EB" />
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
            <Text style={styles.statValue}>14 Fixed</Text>
          </View>
        </View>
      </View>

      {/* Performance & Low-End Devices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance & Lite Mode</Text>

        <View style={styles.menuRow}>
          <Cpu size={20} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Lite Mode</Text>
            <Text style={styles.menuSubtitle}>
              Reduces RAM, battery, and mobile data usage. Recommended for older phones.
            </Text>
          </View>
          <Switch
            value={isLiteMode}
            onValueChange={handleToggleLiteMode}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={isLiteMode ? '#2563EB' : '#64748B'}
          />
        </View>

        <View style={styles.menuRow}>
          <HardDrive size={20} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Storage Footprint ({cacheMB} MB)</Text>
            <Text style={styles.menuSubtitle}>Temporary map tiles and cached photo previews</Text>
          </View>
          <Pressable onPress={handleClearCache} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Clear Cache</Text>
          </Pressable>
        </View>
      </View>

      {/* Preferences & Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <Pressable style={styles.menuRow} onPress={onChangeLanguage}>
          <Globe size={20} color="#4F46E5" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Language / भाषा</Text>
            <Text style={styles.menuSubtitle}>English (Default)</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        {onOpenNotificationCenter && (
          <Pressable style={styles.menuRow} onPress={onOpenNotificationCenter}>
            <Bell size={20} color="#6366F1" />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Notification Center</Text>
              <Text style={styles.menuSubtitle}>View recent reports, status changes, and announcements</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>
        )}

        <View style={styles.menuRow}>
          <Bell size={20} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Hazard & Flood Alert Broadcasts</Text>
            <Text style={styles.menuSubtitle}>High-visibility full-screen emergency warnings</Text>
          </View>
          <Switch
            value={notifyHazards}
            onValueChange={setNotifyHazards}
            trackColor={{ false: '#CBD5E1', true: '#FDE68A' }}
            thumbColor={notifyHazards ? '#D97706' : '#64748B'}
          />
        </View>
      </View>

      {/* Legal & Privacy Center */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal & Privacy Center</Text>

        <Pressable style={styles.menuRow} onPress={onOpenLegalSettings}>
          <ShieldCheck size={20} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>DPDP Privacy & Legal Settings</Text>
            <Text style={styles.menuSubtitle}>ToS v1.1, Privacy Policy, Data Export, Account Deletion</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Help & FAQ Assistant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Knowledge Base</Text>

        <Pressable style={styles.menuRow} onPress={() => setShowFAQModal(true)}>
          <HelpCircle size={20} color="#6366F1" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Civic FAQ & App Assistant</Text>
            <Text style={styles.menuSubtitle}>Answers about clusters, status tracking, DPDP privacy, and voice</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Logout Action */}
      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <LogOut size={18} color="#DC2626" />
        <Text style={styles.logoutText}>Log Out Account</Text>
      </Pressable>

      <FAQHelpModal visible={showFAQModal} onClose={() => setShowFAQModal(false)} />
    </ScrollView>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  userWard: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 11,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
