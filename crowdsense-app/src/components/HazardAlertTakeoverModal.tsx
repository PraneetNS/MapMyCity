import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable } from 'react-native';
import { AlertTriangle, MapPin, X } from 'lucide-react-native';

interface HazardAlertTakeoverModalProps {
  visible: boolean;
  hazardType: string;
  locationName?: string;
  onViewOnMap: () => void;
  onDismiss: () => void;
}

export function HazardAlertTakeoverModal({
  visible,
  hazardType,
  locationName = 'Ward 12, Indiranagar',
  onViewOnMap,
  onDismiss,
}: HazardAlertTakeoverModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onDismiss}>
            <X size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.iconCircle}>
            <AlertTriangle size={36} color="#DC2626" />
          </View>

          <Text style={styles.alertTag}>EMERGENCY HAZARD BROADCAST</Text>
          <Text style={styles.alertTitle}>
            {hazardType === 'waterlogging'
              ? 'Severe Waterlogging & Flood Alert'
              : 'Road Closure / Public Hazard Warning'}
          </Text>

          <View style={styles.locationBox}>
            <MapPin size={16} color="#F87171" />
            <Text style={styles.locationText}>{locationName}</Text>
          </View>

          <Text style={styles.alertBody}>
            High-water accumulation reported by citizens in this area. Avoid low-lying stretches.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>

            <Pressable style={styles.viewBtn} onPress={onViewOnMap}>
              <Text style={styles.viewText}>View on Hazard Map</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#7F1D1D',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FCA5A5',
    letterSpacing: 1,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  locationText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FEE2E2',
  },
  alertBody: {
    fontSize: 13,
    color: '#FECACA',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  dismissText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  viewBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  viewText: {
    color: '#7F1D1D',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
