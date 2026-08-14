import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ShieldCheck, FileText, Download, Trash2, Mail, ChevronRight, X, Cpu, HardDrive, RefreshCw } from 'lucide-react-native';
import { TERMS_OF_SERVICE_MD, PRIVACY_POLICY_MD, GRIEVANCE_OFFICER, LEGAL_VERSIONS } from '../config/legalText';
import { apiFetch } from '../config/apiClient';
import { getUserSession } from '../services/auth';
import { useTheme } from '../theme/ThemeContext';
import { getOrInitializeLiteMode, setLiteModeEnabled } from '../services/liteMode';
import { getCacheStorageFootprintMB, clearAppCache } from '../services/cacheManager';

export default function LegalSettingsScreen() {
  const { theme } = useTheme();
  const [modalContent, setModalContent] = useState<{ title: string; body: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState(false);
  const [cacheMB, setCacheMB] = useState(0.0);

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
      text2: value ? 'Data, RAM, and battery optimizations active.' : 'Full real-time features active.',
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

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const session = await getUserSession();
      const userId = session?.userId || 'anonymous';
      const data = await apiFetch(`/user/export-my-data?user_id=${userId}`);

      Alert.alert(
        'DPDP Data Export Ready',
        JSON.stringify(data, null, 2),
        [{ text: 'OK' }]
      );
      Toast.show({
        type: 'success',
        text1: 'Data Export Generated',
        text2: 'Your personal data dump is ready for download.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: err?.message || 'Could not export user data.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account & Personal Data',
      'This will permanently delete your phone hash and user profile under the DPDP Act 2023. Your past civic reports will remain on the public map as unlinked, anonymized data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const session = await getUserSession();
              await apiFetch('/user/delete-account', {
                method: 'POST',
                body: JSON.stringify({ user_id: session?.userId, phone_hash: session?.phoneHash }),
              });
              Toast.show({
                type: 'success',
                text1: 'Account Deleted',
                text2: 'Your personal data has been erased.',
              });
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Deletion Failed',
                text2: err?.message || 'Could not complete deletion.',
              });
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ShieldCheck size={32} color="#2563EB" />
        <Text style={styles.title}>Legal & Privacy Settings</Text>
        <Text style={styles.subtitle}>
          DPDP Act 2023 & IT Intermediary Rules Compliance Center
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance & Low-End Optimization</Text>
        
        <View style={styles.actionRow}>
          <Cpu size={20} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Lite Mode</Text>
            <Text style={styles.actionSubtitle}>
              Reduces RAM, battery, and mobile data usage. Recommended for older devices.
            </Text>
          </View>
          <Switch value={isLiteMode} onValueChange={handleToggleLiteMode} trackColor={{ false: '#CBD5E1', true: '#93C5FD' }} thumbColor={isLiteMode ? '#2563EB' : '#64748B'} />
        </View>

        <View style={styles.actionRow}>
          <HardDrive size={20} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Storage Cache ({cacheMB} MB)</Text>
            <Text style={styles.actionSubtitle}>
              Temporary map tiles and cached photo previews
            </Text>
          </View>
          <Pressable onPress={handleClearCache} style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 12 }}>Clear Cache</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal Policies ({LEGAL_VERSIONS.TOS_VERSION})</Text>
        
        <Pressable
          style={styles.menuRow}
          onPress={() => setModalContent({ title: 'Terms of Service', body: TERMS_OF_SERVICE_MD })}
        >
          <FileText size={20} color="#334155" />
          <Text style={styles.menuText}>Terms of Service</Text>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() => setModalContent({ title: 'Privacy Policy & DPDP Disclosure', body: PRIVACY_POLICY_MD })}
        >
          <ShieldCheck size={20} color="#334155" />
          <Text style={styles.menuText}>Privacy Policy (DPDP Act)</Text>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() =>
            Alert.alert(
              'Nodal Grievance Officer',
              `Name: ${GRIEVANCE_OFFICER.name}\nEmail: ${GRIEVANCE_OFFICER.email}\nAddress: ${GRIEVANCE_OFFICER.address}\nTimeline: ${GRIEVANCE_OFFICER.responseTimeline}`,
              [{ text: 'OK' }]
            )
          }
        >
          <Mail size={20} color="#334155" />
          <Text style={styles.menuText}>Nodal Grievance Officer</Text>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DPDP Act Data Rights</Text>

        <Pressable style={styles.actionRow} onPress={handleExportData} disabled={isExporting}>
          <Download size={20} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Export My Data</Text>
            <Text style={styles.actionSubtitle}>Download full JSON bundle of your personal data & reports</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.actionRow, { borderColor: '#FEE2E2' }]} onPress={handleDeleteAccount} disabled={isDeleting}>
          <Trash2 size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#DC2626' }]}>Delete Account & Personal Data</Text>
            <Text style={styles.actionSubtitle}>Erase phone hash and identity while keeping unlinked map data</Text>
          </View>
        </Pressable>
      </View>

      {/* Legal Text Full Screen Modal */}
      <Modal visible={Boolean(modalContent)} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalContent?.title}</Text>
            <Pressable onPress={() => setModalContent(null)}>
              <X size={24} color="#0F172A" />
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.legalText}>{modalContent?.body}</Text>
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
    gap: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalBody: {
    padding: 20,
  },
  legalText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 22,
  },
});
