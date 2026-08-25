import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Star, ArrowLeft, Send, CheckCircle2, MessageSquare } from 'lucide-react-native';
import { submitCivicSurvey } from '../services/surveyService';

interface CivicSurveyScreenProps {
  wardId?: string;
  category?: string;
  clusterId?: string;
  onBack: () => void;
  onSubmitSuccess?: () => void;
}

const ASPECT_OPTIONS = [
  { id: 'rapid_resolution', label: '⚡ Fast Resolution' },
  { id: 'high_quality_patch', label: '🛠️ High Quality Fix' },
  { id: 'clean_site', label: '🧹 Clean Site Left' },
  { id: 'good_communication', label: '📢 Clear Updates' },
  { id: 'debris_remaining', label: '⚠️ Debris Remaining' },
  { id: 'partial_fix', label: '⏳ Partial Work Done' },
];

export default function CivicSurveyScreen({
  wardId = 'Ward 4',
  category = 'pothole',
  clusterId,
  onBack,
  onSubmitSuccess,
}: CivicSurveyScreenProps) {
  const [rating, setRating] = useState<number>(5);
  const [speedRating, setSpeedRating] = useState<number>(5);
  const [workmanshipRating, setWorkmanshipRating] = useState<number>(5);
  const [selectedAspects, setSelectedAspects] = useState<string[]>(['rapid_resolution']);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleAspect = (id: string) => {
    if (selectedAspects.includes(id)) {
      setSelectedAspects(selectedAspects.filter((a) => a !== id));
    } else {
      setSelectedAspects([...selectedAspects, id]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitCivicSurvey({
        wardId,
        category,
        clusterId,
        rating,
        aspects: selectedAspects,
        feedbackText,
        resolutionSpeedRating: speedRating,
        workmanshipRating,
      });

      if (result.success) {
        setSubmitted(true);
        Toast.show({
          type: 'success',
          text1: result.offline ? 'Feedback Queued (Offline)' : 'Feedback Submitted!',
          text2: 'Thank you for helping improve our civic services.',
        });
        if (onSubmitSuccess) {
          setTimeout(() => onSubmitSuccess(), 1200);
        }
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Submission Error',
        text2: 'Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <CheckCircle2 color="#22C55E" size={64} />
          <Text style={styles.successTitle}>Thank You, Citizen!</Text>
          <Text style={styles.successSub}>
            Your rating and feedback for {wardId} have been recorded to benchmark municipal contractor quality.
          </Text>
          <Pressable style={styles.doneButton} onPress={onBack}>
            <Text style={styles.doneButtonText}>Return to Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color="#FFFFFF" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Rate Civic Resolution</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Overall Satisfaction</Text>
          <Text style={styles.hintText}>How satisfied are you with the civic works in {wardId}?</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} style={styles.starPressable}>
                <Star
                  size={36}
                  color={star <= rating ? '#FBBF24' : '#4B5563'}
                  fill={star <= rating ? '#FBBF24' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Key Highlights & Aspects</Text>
          <View style={styles.aspectGrid}>
            {ASPECT_OPTIONS.map((aspect) => {
              const active = selectedAspects.includes(aspect.id);
              return (
                <Pressable
                  key={aspect.id}
                  onPress={() => toggleAspect(aspect.id)}
                  style={[styles.aspectBadge, active && styles.aspectBadgeActive]}
                >
                  <Text style={[styles.aspectText, active && styles.aspectTextActive]}>
                    {aspect.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Work Quality & Speed</Text>
          <View style={styles.miniRatingRow}>
            <Text style={styles.miniRatingLabel}>Resolution Speed:</Text>
            <View style={styles.starRowMini}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setSpeedRating(s)}>
                  <Star
                    size={20}
                    color={s <= speedRating ? '#FBBF24' : '#4B5563'}
                    fill={s <= speedRating ? '#FBBF24' : 'transparent'}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.miniRatingRow, { marginTop: 12 }]}>
            <Text style={styles.miniRatingLabel}>Workmanship Quality:</Text>
            <View style={styles.starRowMini}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setWorkmanshipRating(s)}>
                  <Star
                    size={20}
                    color={s <= workmanshipRating ? '#FBBF24' : '#4B5563'}
                    fill={s <= workmanshipRating ? '#FBBF24' : 'transparent'}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <MessageSquare color="#94A3B8" size={18} />
            <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>Comments & Feedback</Text>
          </View>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            placeholder="Tell us what went well or what needs further attention..."
            placeholderTextColor="#64748B"
            value={feedbackText}
            onChangeText={setFeedbackText}
          />
        </View>

        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  starPressable: {
    padding: 6,
  },
  aspectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  aspectBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  aspectBadgeActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  aspectText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  aspectTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  miniRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniRatingLabel: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  starRowMini: {
    flexDirection: 'row',
    gap: 6,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
    minHeight: 90,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  doneButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
