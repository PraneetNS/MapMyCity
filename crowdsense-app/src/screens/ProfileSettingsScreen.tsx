import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
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
  WifiOff,
  DownloadCloud,
  RefreshCw,
  Trash2,
  Share2,
  Radio,
} from 'lucide-react-native';
import { getOrInitializeLiteMode, setLiteModeEnabled } from '../services/liteMode';
import { getOrInitializeDataSaver, setDataSaverEnabled } from '../services/dataSaver';
import { getCacheStorageFootprintMB, clearAppCache } from '../services/cacheManager';
import {
  getDownloadedOfflineAreas,
  AVAILABLE_OFFLINE_PRESETS,
  downloadOfflineArea,
  refreshOfflineArea,
  deleteOfflineArea,
  DownloadedOfflineArea,
} from '../services/offlineMapManager';
import { SocialImpactShareModal } from '../components/SocialImpactShareModal';
import { FAQHelpModal } from '../components/FAQHelpModal';
import { ImpactCardData } from '../services/impactCardGenerator';
import CivicProfileScreen from './CivicProfileScreen';

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
  const [isDataSaver, setIsDataSaver] = useState(false);
  const [cacheMB, setCacheMB] = useState(0.0);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCivicProfileModal, setShowCivicProfileModal] = useState(false);
  const [shareData, setShareData] = useState<ImpactCardData | null>(null);

  // Offline maps state
  const [downloadedAreas, setDownloadedAreas] = useState<DownloadedOfflineArea[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Notification Preference States
  const [notifyHazards, setNotifyHazards] = useState(true);

  useEffect(() => {
    getOrInitializeLiteMode().then(setIsLiteMode);
    getOrInitializeDataSaver().then(setIsDataSaver);
    getCacheStorageFootprintMB().then(setCacheMB);
    getDownloadedOfflineAreas().then(setDownloadedAreas);
  }, []);

  const handleToggleLiteMode = async (value: boolean) => {
    setIsLiteMode(value);
    await setLiteModeEnabled(value);
    Toast.show({
      type: 'success',
      text1: value ? 'Lite Mode Enabled' : 'Standard Mode Enabled',
      text2: value ? 'RAM, ML models, and animation optimizations active.' : 'Full real-time layers active.',
    });
  };

  const handleToggleDataSaver = async (value: boolean) => {
    setIsDataSaver(value);
    await setDataSaverEnabled(value);
    Toast.show({
      type: 'success',
      text1: value ? 'Data Saver Enabled' : 'Data Saver Disabled',
      text2: value ? 'Low-res thumbnails & Wi-Fi only background syncs.' : 'High-resolution images enabled.',
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

  const handleDownloadArea = async (presetId: string) => {
    setDownloadingId(presetId);
    try {
      await downloadOfflineArea(presetId);
      const updated = await getDownloadedOfflineAreas();
      setDownloadedAreas(updated);
      const newMB = await getCacheStorageFootprintMB();
      setCacheMB(newMB);
      Toast.show({
        type: 'success',
        text1: 'Area Downloaded for Offline Use',
        text2: 'Map tiles and local clusters are available without internet.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: err?.message || 'Could not download area map.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRefreshArea = async (areaId: string) => {
    setDownloadingId(areaId);
    try {
      await refreshOfflineArea(areaId);
      const updated = await getDownloadedOfflineAreas();
      setDownloadedAreas(updated);
      Toast.show({
        type: 'success',
        text1: 'Offline Area Refreshed',
        text2: 'Updated with latest live clusters from server.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Refresh Failed',
        text2: err?.message || 'Could not refresh offline package.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    await deleteOfflineArea(areaId);
    const updated = await getDownloadedOfflineAreas();
    setDownloadedAreas(updated);
    const newMB = await getCacheStorageFootprintMB();
    setCacheMB(newMB);
    Toast.show({
      type: 'success',
      text1: 'Offline Area Removed',
      text2: 'Device storage reclaimed.',
    });
  };

  const handleOpenMonthlyShareCard = () => {
    setShareData({
      type: 'monthly_digest',
      title: 'Making Our Streets Safer',
      stats: {
        issuesResolved: 14,
        trustScorePercent: 94,
        streakWeeks: 6,
      },
    });
    setShowShareModal(true);
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
              <Text style={styles.statLabel}>Streak</Text>
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

        {/* Share Impact Card Action */}
        <Pressable onPress={handleOpenMonthlyShareCard} style={styles.shareImpactBtn}>
          <Share2 size={16} color="#4F46E5" />
          <Text style={styles.shareImpactBtnText}>Share Monthly Civic Impact Story</Text>
        </Pressable>

        {/* View Full Civic Reputation & Badges Action */}
        <Pressable
          onPress={() => setShowCivicProfileModal(true)}
          style={[styles.shareImpactBtn, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', marginTop: 8 }]}
        >
          <Award size={16} color="#2563EB" />
          <Text style={[styles.shareImpactBtnText, { color: '#2563EB' }]}>
            View Civic Reputation, Score & Badges
          </Text>
        </Pressable>
      </View>

      {/* Performance, Network & Storage Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance & Data Optimization</Text>

        {/* Data Saver Mode */}
        <View style={styles.menuRow}>
          <Radio size={20} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Data Saver Mode</Text>
            <Text style={styles.menuSubtitle}>
              Compresses thumbnails and defers heavy background syncs to Wi-Fi.
            </Text>
          </View>
          <Switch
            value={isDataSaver}
            onValueChange={handleToggleDataSaver}
            trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
            thumbColor={isDataSaver ? '#0284C7' : '#64748B'}
          />
        </View>

        {/* Lite Mode */}
        <View style={styles.menuRow}>
          <Cpu size={20} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Lite Mode (RAM & CPU)</Text>
            <Text style={styles.menuSubtitle}>
              Reduces memory footprint and heavy animations for low-spec phones.
            </Text>
          </View>
          <Switch
            value={isLiteMode}
            onValueChange={handleToggleLiteMode}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={isLiteMode ? '#2563EB' : '#64748B'}
          />
        </View>

        {/* Offline Maps Download */}
        <Pressable style={styles.menuRow} onPress={() => setShowOfflineModal(true)}>
          <WifiOff size={20} color="#7C3AED" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Offline Map Areas ({downloadedAreas.length} Downloaded)</Text>
            <Text style={styles.menuSubtitle}>
              Download neighborhood map tiles & clusters for use without mobile data.
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        {/* Storage Footprint */}
        <View style={styles.menuRow}>
          <HardDrive size={20} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Storage Usage ({cacheMB} MB)</Text>
            <Text style={styles.menuSubtitle}>Offline maps, model weights, and cached photo previews</Text>
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

      {/* FAQ Help Assistant Modal */}
      <FAQHelpModal
        visible={showFAQModal}
        onClose={() => setShowFAQModal(false)}
      />

      {/* Full Civic Profile Modal */}
      <Modal visible={showCivicProfileModal} animationType="slide">
        <CivicProfileScreen onBack={() => setShowCivicProfileModal(false)} />
      </Modal>

      <SocialImpactShareModal
        visible={showShareModal}
        data={shareData}
        onClose={() => setShowShareModal(false)}
      />

      {/* Offline Maps Management Modal */}
      <Modal visible={showOfflineModal} animationType="slide" onRequestClose={() => setShowOfflineModal(false)}>
        <View style={styles.offlineModalContainer}>
          <View style={styles.offlineModalHeader}>
            <Text style={styles.offlineModalTitle}>Offline Map Areas</Text>
            <Pressable onPress={() => setShowOfflineModal(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.offlineModalContent}>
            <Text style={styles.offlineModalSubtitle}>
              Select your neighborhood to download high-resolution map tiles and verified cluster data for offline exploration.
            </Text>

            {/* Downloaded Areas Section */}
            {downloadedAreas.length > 0 && (
              <View style={styles.offlineSection}>
                <Text style={styles.offlineSectionTitle}>Downloaded on This Device</Text>
                {downloadedAreas.map((area) => (
                  <View key={area.id} style={styles.downloadedCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.downloadedName}>{area.name}</Text>
                      <Text style={styles.downloadedMeta}>
                        {area.sizeMB} MB • {area.clusterCount} cached issues • Updated{' '}
                        {new Date(area.lastUpdatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.downloadedActions}>
                      <Pressable
                        onPress={() => handleRefreshArea(area.id)}
                        disabled={Boolean(downloadingId)}
                        style={styles.areaActionBtn}
                      >
                        {downloadingId === area.id ? (
                          <ActivityIndicator size="small" color="#4F46E5" />
                        ) : (
                          <RefreshCw size={16} color="#4F46E5" />
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteArea(area.id)}
                        style={styles.areaActionBtn}
                      >
                        <Trash2 size={16} color="#DC2626" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Available Presets */}
            <View style={styles.offlineSection}>
              <Text style={styles.offlineSectionTitle}>Available Neighborhood Packages</Text>
              {AVAILABLE_OFFLINE_PRESETS.map((preset) => {
                const isDownloaded = downloadedAreas.some((d) => d.id === preset.id);
                return (
                  <View key={preset.id} style={styles.presetCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text style={styles.presetDistrict}>{preset.district} • ~{preset.estimatedMB} MB</Text>
                    </View>
                    {isDownloaded ? (
                      <View style={styles.downloadedBadge}>
                        <Text style={styles.downloadedBadgeText}>Saved</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleDownloadArea(preset.id)}
                        disabled={Boolean(downloadingId)}
                        style={styles.downloadAreaBtn}
                      >
                        {downloadingId === preset.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <DownloadCloud size={14} color="#FFFFFF" />
                            <Text style={styles.downloadAreaBtnText}>Download</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    gap: 14,
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
  shareImpactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  shareImpactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
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
  offlineModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  offlineModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  offlineModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeModalBtn: {
    padding: 6,
  },
  closeModalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  offlineModalContent: {
    padding: 16,
    gap: 16,
  },
  offlineModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  offlineSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offlineSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  downloadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  downloadedName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  downloadedMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  downloadedActions: {
    flexDirection: 'row',
    gap: 6,
  },
  areaActionBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  presetName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  presetDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  downloadAreaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadAreaBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  downloadedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
});
