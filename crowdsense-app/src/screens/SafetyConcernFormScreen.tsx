import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ShieldAlert, EyeOff, ArrowLeft, Send } from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';

interface SafetyConcernFormScreenProps {
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export default function SafetyConcernFormScreen({
  onBack,
  onSubmitSuccess,
}: SafetyConcernFormScreenProps) {
  const [subType, setSubType] = useState('poor_lighting');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch('/submissions', {
        method: 'POST',
        body: JSON.stringify({
          device_id: `dev_${Date.now()}`,
          mission_type: 'safety_concern',
          notes: notes ? `[${subType}] ${notes}` : `[${subType}] Safety concern area reported`,
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });

      Toast.show({
        type: 'success',
        text1: 'Anonymous Safety Concern Mapped',
        text2: 'Your reporter identity is 100% hidden on public heatmaps.',
      });
      onSubmitSuccess();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: err?.message || 'Could not map safety concern.',
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
        <Text style={styles.title}>Women’s Safety Mapping</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.banner}>
          <EyeOff size={24} color="#DB2777" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>100% Anonymous Reporting</Text>
            <Text style={styles.bannerSubtitle}>
              Reporter identity is NEVER shown on public maps or to other users.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Safety Concern Type</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'poor_lighting', label: 'Poor Street Lighting' },
            { id: 'broken_lights', label: 'Broken Streetlights' },
            { id: 'isolated_stretch', label: 'Isolated Stretch' },
            { id: 'harassment_hotspot', label: 'Harassment Hotspot' },
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, subType === item.id && styles.chipActive]}
              onPress={() => setSubType(item.id)}
            >
              <Text style={[styles.chipText, subType === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location Details / Notes (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Describe lighting issues or landmarks (no personal names)..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {isSubmitting ? 'Mapping Area...' : 'Submit Anonymous Safety Concern'}
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
    gap: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FCE7F3',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9D174D',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#BE185D',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: {
    backgroundColor: '#DB2777',
    borderColor: '#DB2777',
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontSize: 13,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
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
    backgroundColor: '#DB2777',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
