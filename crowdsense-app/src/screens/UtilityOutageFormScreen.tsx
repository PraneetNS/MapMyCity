import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Zap, Droplet, ArrowLeft, Send } from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';

interface UtilityOutageFormScreenProps {
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export default function UtilityOutageFormScreen({
  onBack,
  onSubmitSuccess,
}: UtilityOutageFormScreenProps) {
  const [utilityType, setUtilityType] = useState<'water' | 'power'>('water');
  const [status, setStatus] = useState<'outage' | 'restored' | 'scheduled_disruption'>('outage');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch('/utilities/report', {
        method: 'POST',
        body: JSON.stringify({
          utility_type: utilityType,
          status: status,
          ward_id: 'ward_12',
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });

      Toast.show({
        type: 'success',
        text1: 'Utility Status Broadcasted',
        text2: 'Ward outage map updated instantly.',
      });
      onSubmitSuccess();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Outage Report Failed',
        text2: err?.message || 'Could not report utility status.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Utility Disruption Report</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.banner}>
          <Zap size={24} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Fast 10-Second Report (Photo-Free)</Text>
            <Text style={styles.bannerSubtitle}>
              Direct ward grid status broadcast without camera requirements.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Utility Type</Text>
        <View style={styles.cardRow}>
          <Pressable
            style={[styles.typeCard, utilityType === 'water' && styles.typeCardActive]}
            onPress={() => setUtilityType('water')}
          >
            <Droplet size={28} color={utilityType === 'water' ? '#2563EB' : '#64748B'} />
            <Text style={[styles.typeTitle, utilityType === 'water' && styles.typeTitleActive]}>
              Water Supply
            </Text>
          </Pressable>

          <Pressable
            style={[styles.typeCard, utilityType === 'power' && styles.typeCardActive]}
            onPress={() => setUtilityType('power')}
          >
            <Zap size={28} color={utilityType === 'power' ? '#D97706' : '#64748B'} />
            <Text style={[styles.typeTitle, utilityType === 'power' && styles.typeTitleActive]}>
              Power / Electricity
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Current Status</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'outage', label: 'Unscheduled Outage' },
            { id: 'restored', label: 'Service Restored' },
            { id: 'scheduled_disruption', label: 'Scheduled Maintenance' },
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, status === item.id && styles.chipActive]}
              onPress={() => setStatus(item.id as any)}
            >
              <Text style={[styles.chipText, status === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {isSubmitting ? 'Updating Grid...' : 'Broadcast Utility Status'}
          </Text>
        </Pressable>
      </View>
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
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    gap: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#065F46',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  typeCardActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  typeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  typeTitleActive: {
    color: '#059669',
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
