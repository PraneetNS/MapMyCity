import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Platform, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { MapPin, PlusCircle, List, User } from 'lucide-react-native';

import { ThemeProvider } from './src/theme/ThemeContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { HazardAlertTakeoverModal } from './src/components/HazardAlertTakeoverModal';

import SplashScreen from './src/screens/SplashScreen';
import LanguageSelectScreen from './src/screens/LanguageSelectScreen';
import AuthScreen from './src/screens/AuthScreen';
import ConsentScreen from './src/screens/ConsentScreen';

import MapScreen from './src/screens/MapScreen';
import SubmissionsScreen from './src/screens/SubmissionsScreen';
import ProfileSettingsScreen from './src/screens/ProfileSettingsScreen';
import LegalSettingsScreen from './src/screens/LegalSettingsScreen';

import ReportCategoryPickerScreen from './src/screens/ReportCategoryPickerScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import AccessibilityAuditFormScreen from './src/screens/AccessibilityAuditFormScreen';
import SafetyConcernFormScreen from './src/screens/SafetyConcernFormScreen';
import UtilityOutageFormScreen from './src/screens/UtilityOutageFormScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import ClusterDetailScreen from './src/screens/ClusterDetailScreen';
import { SocialImpactShareModal } from './src/components/SocialImpactShareModal';

import { getUserSession, logoutUser } from './src/services/auth';
import { initializeQuickActions } from './src/services/quickActions';
import { incrementAppSessionCount } from './src/services/storeReview';
import {
  shouldSuggestDataSaver,
  markDataSaverSuggestionSeen,
  setDataSaverEnabled,
} from './src/services/dataSaver';
import { ImpactCardData } from './src/services/impactCardGenerator';

import { t } from './src/config/i18n';

import OnboardingWalkthroughScreen from './src/screens/OnboardingWalkthroughScreen';

type AuthStep = 'splash' | 'walkthrough' | 'language' | 'auth' | 'consent' | 'authenticated';
type ActiveTab = 'home' | 'my_reports' | 'profile';
type ModalFlow = null | 'picker' | 'standard' | 'accessibility' | 'safety' | 'utility' | 'legal' | 'notifications' | 'cluster_detail';

export default function App() {
  const [authStep, setAuthStep] = useState<AuthStep>('splash');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeModal, setActiveModal] = useState<ModalFlow>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hazardAlertVisible, setHazardAlertVisible] = useState(false);

  // Asset Tagging Pre-fill State (Part 7)
  const [taggedAsset, setTaggedAsset] = useState<{
    assetId: string;
    category?: any;
    latitude?: number;
    longitude?: number;
  } | null>(null);

  // Share Impact Card State (Part 3)
  const [shareData, setShareData] = useState<ImpactCardData | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Initial App Startup Hooks
  useEffect(() => {
    // 1. Check user session
    getUserSession().then((session) => {
      if (session) {
        setAuthStep('authenticated');
      }
    });

    // 2. Track app session count for contextual store review
    incrementAppSessionCount();

    // 3. Register icon long-press quick actions (Part 2)
    initializeQuickActions((action) => {
      if (action === 'report_issue') {
        setActiveModal('standard');
      } else if (action === 'open_map') {
        setActiveTab('home');
        setActiveModal(null);
      } else if (action === 'my_reports') {
        setActiveTab('my_reports');
        setActiveModal(null);
      }
    });

    // 4. Data Saver Auto-suggestion on sustained cellular connection (Part 8)
    shouldSuggestDataSaver().then((suggest) => {
      if (suggest) {
        Alert.alert(
          'Mobile Data Detected',
          'Would you like to turn on Data Saver Mode to compress map photo thumbnails and defer heavy background syncs to Wi-Fi?',
          [
            {
              text: 'No Thanks',
              style: 'cancel',
              onPress: () => markDataSaverSuggestionSeen(),
            },
            {
              text: 'Enable Data Saver',
              onPress: async () => {
                await setDataSaverEnabled(true);
                await markDataSaverSuggestionSeen();
                Toast.show({
                  type: 'success',
                  text1: 'Data Saver Active',
                  text2: 'Optimizing mobile data consumption.',
                });
              },
            },
          ]
        );
      }
    });
  }, []);

  const handleSplashFinish = async () => {
    const session = await getUserSession();
    if (session) {
      setAuthStep('authenticated');
    } else {
      setAuthStep('walkthrough');
    }
  };

  const handleWalkthroughComplete = () => setAuthStep('language');
  const handleLanguageComplete = () => setAuthStep('auth');
  const handleAuthSuccess = () => setAuthStep('consent');
  const handleConsentAccept = () => setAuthStep('authenticated');

  const handleLogout = async () => {
    await logoutUser();
    setActiveTab('home');
    setAuthStep('walkthrough');
  };

  const handleShareClusterImpact = (clusterData: any) => {
    setShareData({
      type: 'resolved_issue',
      title: `${clusterData.mission_type?.replace('_', ' ').toUpperCase() || 'CIVIC ISSUE'} RESOLVED!`,
      category: clusterData.mission_type,
      issueId: clusterData.id,
      wardName: 'Bengaluru East',
      beforePhotoUrl: clusterData.photo_url || undefined,
    });
    setShareModalVisible(true);
  };

  return (
    <GestureHandlerRootView style={styles.flexOne}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <SafeAreaView style={styles.rootContainer}>
              {/* Root Offline Network Indicator */}
              <OfflineBanner isOffline={isOffline} />

              {/* Render Unauthenticated Auth Stack or Authenticated Main Shell */}
              {authStep === 'splash' && <SplashScreen onFinish={handleSplashFinish} />}
              {authStep === 'walkthrough' && <OnboardingWalkthroughScreen onComplete={handleWalkthroughComplete} />}
              {authStep === 'language' && <LanguageSelectScreen onSelectLanguage={handleLanguageComplete} />}
              {authStep === 'auth' && (
                <View style={styles.flexOne}>
                  <AuthScreen onAuthSuccess={handleAuthSuccess} />
                </View>
              )}
              {authStep === 'consent' && (
                <View style={styles.flexOne}>
                  <ConsentScreen onAcceptConsent={handleConsentAccept} />
                </View>
              )}

              {authStep === 'authenticated' && (
                <View style={styles.flexOne}>
                  {/* Active Tab Screen */}
                  <View style={styles.mainContent}>
                    {activeTab === 'home' && <MapScreen />}
                    {activeTab === 'my_reports' && <SubmissionsScreen />}
                    {activeTab === 'profile' && (
                      <ProfileSettingsScreen
                        onOpenLegalSettings={() => setActiveModal('legal')}
                        onChangeLanguage={() => setAuthStep('language')}
                        onOpenNotificationCenter={() => setActiveModal('notifications')}
                        onLogout={handleLogout}
                      />
                    )}
                  </View>

                  {/* Master 4-Tab Bottom Navigation Bar */}
                  <View style={styles.tabBar}>
                    <Pressable
                      style={styles.tabItem}
                      onPress={() => setActiveTab('home')}
                    >
                      <MapPin size={22} color={activeTab === 'home' ? '#4F46E5' : '#64748B'} />
                      <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
                        {t('mapTab')}
                      </Text>
                    </Pressable>

                    {/* Center Modal Launcher "Report" Tab */}
                    <Pressable
                      style={styles.reportTabLauncher}
                      onPress={() => {
                        setTaggedAsset(null);
                        setActiveModal('picker');
                      }}
                    >
                      <View style={styles.reportIconCircle}>
                        <PlusCircle size={28} color="#FFFFFF" />
                      </View>
                      <Text style={styles.reportLabel}>{t('reportTab')}</Text>
                    </Pressable>

                    <Pressable
                      style={styles.tabItem}
                      onPress={() => setActiveTab('my_reports')}
                    >
                      <List size={22} color={activeTab === 'my_reports' ? '#4F46E5' : '#64748B'} />
                      <Text style={[styles.tabLabel, activeTab === 'my_reports' && styles.tabLabelActive]}>
                        {t('myReportsTab')}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.tabItem}
                      onPress={() => setActiveTab('profile')}
                    >
                      <User size={22} color={activeTab === 'profile' ? '#4F46E5' : '#64748B'} />
                      <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
                        {t('profileTab')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Category-Tailored Modal Stack */}
              <Modal visible={Boolean(activeModal)} animationType="slide">
                {activeModal === 'picker' && (
                  <ReportCategoryPickerScreen
                    onSelectCategory={(catId) => {
                      if (catId === 'standard') setActiveModal('standard');
                      else if (catId === 'accessibility') setActiveModal('accessibility');
                      else if (catId === 'safety_concern') setActiveModal('safety');
                      else if (catId === 'utility_outage') setActiveModal('utility');
                    }}
                    onClose={() => setActiveModal(null)}
                  />
                )}

                {activeModal === 'standard' && (
                  <CaptureScreen
                    onCaptureSuccess={() => {
                      setTaggedAsset(null);
                      setActiveModal(null);
                    }}
                    initialAssetId={taggedAsset?.assetId}
                    initialCategory={taggedAsset?.category}
                    initialLocation={
                      taggedAsset?.latitude && taggedAsset?.longitude
                        ? { latitude: taggedAsset.latitude, longitude: taggedAsset.longitude }
                        : undefined
                    }
                  />
                )}

                {activeModal === 'accessibility' && (
                  <AccessibilityAuditFormScreen
                    onBack={() => setActiveModal('picker')}
                    onSubmitSuccess={() => setActiveModal(null)}
                  />
                )}

                {activeModal === 'safety' && (
                  <SafetyConcernFormScreen
                    onBack={() => setActiveModal('picker')}
                    onSubmitSuccess={() => setActiveModal(null)}
                  />
                )}

                {activeModal === 'utility' && (
                  <UtilityOutageFormScreen
                    onBack={() => setActiveModal('picker')}
                    onSubmitSuccess={() => setActiveModal(null)}
                  />
                )}

                {activeModal === 'notifications' && (
                  <NotificationCenterScreen
                    onBack={() => setActiveModal(null)}
                    onSelectCluster={(clusterId) => {
                      setSelectedClusterId(clusterId);
                      setActiveModal('cluster_detail');
                    }}
                  />
                )}

                {activeModal === 'cluster_detail' && (
                  <ClusterDetailScreen
                    clusterId={selectedClusterId || ''}
                    onBack={() => setActiveModal('notifications')}
                    onShareImpact={handleShareClusterImpact}
                  />
                )}

                {activeModal === 'legal' && (
                  <View style={styles.flexOne}>
                    <Pressable
                      style={styles.modalCloseHeader}
                      onPress={() => setActiveModal(null)}
                    >
                      <Text style={styles.modalCloseText}>← Back to Profile Settings</Text>
                    </Pressable>
                    <LegalSettingsScreen />
                  </View>
                )}
              </Modal>

              {/* Shareable Impact Card Modal (Part 3) */}
              <SocialImpactShareModal
                visible={shareModalVisible}
                data={shareData}
                onClose={() => setShareModalVisible(false)}
              />

              {/* Root Emergency Hazard Takeover Broadcast Overlay */}
              <HazardAlertTakeoverModal
                visible={hazardAlertVisible}
                hazardType="waterlogging"
                onViewOnMap={() => {
                  setHazardAlertVisible(false);
                  setActiveTab('home');
                }}
                onDismiss={() => setHazardAlertVisible(false)}
              />

              <Toast />
            </SafeAreaView>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'android' ? 76 : 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'android' ? 14 : 6,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  reportTabLauncher: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    flex: 1,
  },
  reportIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  reportLabel: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalCloseHeader: {
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
  },
});
