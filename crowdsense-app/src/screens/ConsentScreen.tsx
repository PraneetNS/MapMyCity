import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { ShieldAlert, FileText, CheckSquare, Square, Mail, Info } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Button, Card } from '../components';
import {
  LEGAL_VERSIONS,
  TERMS_OF_SERVICE_MD,
  PRIVACY_POLICY_MD,
  GRIEVANCE_OFFICER,
} from '../config/legalText';
import { apiFetch } from '../config/apiClient';
import { t } from '../config/i18n';

const CONSENT_STORAGE_KEY = 'CROWDSENSE_LEGAL_CONSENT';

interface ConsentScreenProps {
  userId?: string;
  onConsentAccepted?: () => void;
  onAcceptConsent?: () => void;
}

export default function ConsentScreen({ userId = 'user_anon', onConsentAccepted, onAcceptConsent }: ConsentScreenProps) {
  const { theme } = useTheme();

  const [acceptedTos, setAcceptedTos] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [activeTab, setActiveTab] = useState<'tos' | 'privacy'>('tos');
  const [grievanceModalVisible, setGrievanceModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProceed = acceptedTos && acceptedPrivacy;

  const handleAcceptConsent = async () => {
    if (!canProceed) {
      Toast.show({
        type: 'error',
        text1: 'Consent Required',
        text2: 'You must check both agreement boxes to proceed.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const consentPayload = {
        user_id: userId,
        tos_version: LEGAL_VERSIONS.TOS_VERSION,
        privacy_version: LEGAL_VERSIONS.PRIVACY_VERSION,
        accepted_at: new Date().toISOString(),
      };

      // Save locally
      await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentPayload));

      // Sync to backend DB
      try {
        await apiFetch('/user/consent', {
          method: 'POST',
          body: JSON.stringify(consentPayload),
        });
      } catch (_) {
        // Continue if offline, will retry later
      }

      Toast.show({
        type: 'success',
        text1: 'Terms Accepted',
        text2: 'Thank you for committing to responsible civic reporting.',
      });

      if (onConsentAccepted) onConsentAccepted();
      if (onAcceptConsent) onAcceptConsent();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Save Consent',
        text2: err?.message || 'Unexpected error while recording consent.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.neutral[100] }]}>
      {/* Header */}
      <View style={styles.header}>
        <ShieldAlert size={32} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>
          {t('acceptTermsTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.neutral[600] }]}>
          {t('acceptTermsSubtitle')}
        </Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('tos')}
          style={[
            styles.tabButton,
            activeTab === 'tos' && { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.tabText, activeTab === 'tos' && styles.tabTextActive]}>
            Terms of Service (v{LEGAL_VERSIONS.TOS_VERSION})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('privacy')}
          style={[
            styles.tabButton,
            activeTab === 'privacy' && { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy Policy (v{LEGAL_VERSIONS.PRIVACY_VERSION})
          </Text>
        </Pressable>
      </View>

      {/* Policy Text Scroll */}
      <Card style={styles.card} elevation="low">
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ padding: 12 }}>
          <Text style={[styles.policyText, { color: theme.colors.neutral[800] }]}>
            {activeTab === 'tos' ? TERMS_OF_SERVICE_MD : PRIVACY_POLICY_MD}
          </Text>
        </ScrollView>
      </Card>

      {/* Checkboxes */}
      <View style={styles.checkboxSection}>
        <Pressable
          onPress={() => setAcceptedTos(!acceptedTos)}
          style={styles.checkboxRow}
        >
          {acceptedTos ? (
            <CheckSquare size={22} color={theme.colors.primary} />
          ) : (
            <Square size={22} color={theme.colors.neutral[400]} />
          )}
          <Text style={[styles.checkboxLabel, { color: theme.colors.neutral[800] }]}>
            I agree to the Terms of Service & promise not to file false or harassing reports.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
          style={styles.checkboxRow}
        >
          {acceptedPrivacy ? (
            <CheckSquare size={22} color={theme.colors.primary} />
          ) : (
            <Square size={22} color={theme.colors.neutral[400]} />
          )}
          <Text style={[styles.checkboxLabel, { color: theme.colors.neutral[800] }]}>
            I consent to the Privacy Policy (SHA-256 phone hashing & GPS coordinates collection).
          </Text>
        </Pressable>
      </View>

      {/* Footer & Grievance Button */}
      <View style={styles.footer}>
        <Button
          title={isSubmitting ? 'Recording Consent...' : t('acceptContinue')}
          onPress={handleAcceptConsent}
          disabled={!canProceed || isSubmitting}
          loading={isSubmitting}
          style={{ width: '100%' }}
        />

        <Pressable
          onPress={() => setGrievanceModalVisible(true)}
          style={styles.grievanceLink}
        >
          <Mail size={14} color={theme.colors.primary} />
          <Text style={[styles.grievanceText, { color: theme.colors.primary }]}>
            Report a Legal Concern / Grievance Officer
          </Text>
        </Pressable>
      </View>

      {/* Grievance Modal */}
      <Modal visible={grievanceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Info size={24} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>Grievance Redressal (IT Rules 2021)</Text>
            </View>

            <View style={styles.grievanceCard}>
              <Text style={styles.grievanceLabel}>Nodal Grievance Officer:</Text>
              <Text style={styles.grievanceValue}>{GRIEVANCE_OFFICER.name}</Text>

              <Text style={styles.grievanceLabel}>Official Email Contact:</Text>
              <Text style={styles.grievanceValue}>{GRIEVANCE_OFFICER.email}</Text>

              <Text style={styles.grievanceLabel}>Postal Address:</Text>
              <Text style={styles.grievanceValue}>{GRIEVANCE_OFFICER.address}</Text>

              <Text style={styles.grievanceLabel}>Resolution Timeline:</Text>
              <Text style={styles.grievanceValue}>{GRIEVANCE_OFFICER.responseTimeline}</Text>
            </View>

            <Button
              title="Close"
              onPress={() => setGrievanceModalVisible(false)}
              style={{ width: '100%', marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'semibold',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  card: {
    flex: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  policyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxSection: {
    gap: 12,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    gap: 12,
    alignItems: 'center',
  },
  grievanceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  grievanceText: {
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  grievanceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  grievanceLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
  },
  grievanceValue: {
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 4,
  },
});
