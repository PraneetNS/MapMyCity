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
import { Accessibility, Camera, ArrowLeft, Send } from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';

interface AccessibilityAuditFormScreenProps {
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export default function AccessibilityAuditFormScreen({
  onBack,
  onSubmitSuccess,
}: AccessibilityAuditFormScreenProps) {
  const [locationType, setLocationType] = useState('public_building');
  const [issueType, setIssueType] = useState('missing_ramp');
  const [severity, setSeverity] = useState('blocks_access_entirely');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch('/submissions/accessibility-audit', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: `sub_${Date.now()}`,
          location_type: locationType,
          issue_type: issueType,
          severity,
          audit_notes: notes,
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });

      Toast.show({
        type: 'success',
        text1: 'Accessibility Audit Filed',
        text2: 'Shared with disability rights NGOs and municipal partners.',
      });
      onSubmitSuccess();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Audit Submission Failed',
        text2: err?.message || 'Could not submit accessibility audit.',
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
        <Text style={styles.title}>Accessibility Audit</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.banner}>
          <Accessibility size={24} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Disability Rights NGO Export</Text>
            <Text style={styles.bannerSubtitle}>Structured audit data is shared with CSR and NGO partners.</Text>
          </View>
        </View>

        <Text style={styles.label}>Location Type</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'public_building', label: 'Public Building' },
            { id: 'transit_stop', label: 'Transit Stop' },
            { id: 'footpath', label: 'Footpath' },
            { id: 'public_toilet', label: 'Public Toilet' },
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, locationType === item.id && styles.chipActive]}
              onPress={() => setLocationType(item.id)}
            >
              <Text style={[styles.chipText, locationType === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'missing_ramp', label: 'Missing Ramp' },
            { id: 'broken_ramp', label: 'Broken Ramp' },
            { id: 'broken_lift', label: 'Broken Lift' },
            { id: 'no_accessible_toilet', label: 'No Accessible Toilet' },
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, issueType === item.id && styles.chipActive]}
              onPress={() => setIssueType(item.id)}
            >
              <Text style={[styles.chipText, issueType === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Severity</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'blocks_access_entirely', label: 'Blocks Access Entirely' },
            { id: 'makes_access_difficult', label: 'Makes Access Difficult' },
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, severity === item.id && styles.chipActive]}
              onPress={() => setSeverity(item.id)}
            >
              <Text style={[styles.chipText, severity === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Audit Notes (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Describe barrier details or wheelchair ramp dimensions..."
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
            {isSubmitting ? 'Submitting Audit...' : 'Submit Accessibility Audit'}
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
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
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
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
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
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
