import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { AlertTriangle, Droplets, ShieldAlert, Radio, AlertOctagon } from 'lucide-react-native';
import { Button } from './Button';
import { apiFetch } from '../config/apiClient';

interface HazardReportModalProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onReportSuccess: () => void;
}

export const HAZARD_TYPES = [
  { id: 'waterlogging', title: 'Monsoon Waterlogging', icon: Droplets, color: '#0284C7' },
  { id: 'road_closure', title: 'Road Block / Closure', icon: AlertOctagon, color: '#DC2626' },
  { id: 'signal_down', title: 'Traffic Signal Down', icon: Radio, color: '#D97706' },
  { id: 'fallen_tree', title: 'Fallen Tree / Debris', icon: ShieldAlert, color: '#059669' },
  { id: 'other', title: 'Other Urgency Hazard', icon: AlertTriangle, color: '#4B5563' },
];

export function HazardReportModal({
  visible,
  userLocation,
  onClose,
  onReportSuccess,
}: HazardReportModalProps) {
  const [selectedType, setSelectedType] = useState<string>('waterlogging');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitHazard = async () => {
    if (!userLocation) {
      Toast.show({
        type: 'error',
        text1: 'Location Unavailable',
        text2: 'Enable GPS location to submit hazard alerts.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/hazards/report', {
        method: 'POST',
        body: JSON.stringify({
          hazard_type: selectedType,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }),
      });

      Toast.show({
        type: 'success',
        text1: 'Hazard Alert Broadcasted!',
        text2: 'Thank you for keeping fellow citizens safe.',
      });

      onReportSuccess();
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Broadcast Failed',
        text2: err?.message || 'Could not send hazard alert.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <AlertTriangle size={24} color="#DC2626" />
            <Text style={styles.modalTitle}>Report Fast Live Hazard</Text>
          </View>
          <Text style={styles.modalSubtitle}>
            Photo-free emergency hazard report for public safety (auto-expires in 3 hours).
          </Text>

          <View style={styles.hazardGrid}>
            {HAZARD_TYPES.map((h) => {
              const Icon = h.icon;
              const isSelected = selectedType === h.id;

              return (
                <Pressable
                  key={h.id}
                  onPress={() => setSelectedType(h.id)}
                  style={[
                    styles.hazardCard,
                    isSelected && { borderColor: h.color, backgroundColor: `${h.color}15` },
                  ]}
                >
                  <Icon size={22} color={h.color} />
                  <Text style={[styles.hazardCardText, isSelected && { color: h.color, fontWeight: 'bold' }]}>
                    {h.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            title={isSubmitting ? 'Broadcasting...' : 'Broadcast Emergency Hazard'}
            onPress={handleSubmitHazard}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ marginTop: 16, backgroundColor: '#DC2626' }}
          />

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  hazardGrid: {
    gap: 10,
  },
  hazardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  hazardCardText: {
    fontSize: 14,
    color: '#334155',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748B',
  },
});
