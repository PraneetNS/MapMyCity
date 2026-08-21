import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  Dimensions,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Network from 'expo-network';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import {
  Cone,
  Trash2,
  Volume2,
  Accessibility,
  Hammer,
  Check,
  Wifi,
  ChevronLeft,
  Info,
  MapPin,
  Mic,
  CloudOff,
  RefreshCw,
  Globe,
  CheckSquare,
  Square,
  ShieldAlert,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Wand2,
} from 'lucide-react-native';
import { useResponsive } from '../hooks/useResponsive';
import { PermissionPromptModal } from '../components/PermissionPromptModal';
import { checkPermissionStatus, requestNativePermission } from '../services/permissionManager';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Badge, LoadingSpinner } from '../components';
import { getDeviceId } from '../utils/device';
import { addDraftReport } from '../services/localQueue';
import { useDraftSync } from '../hooks/useDraftSync';
import {
  SUPPORTED_LOCALES,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '../services/speech';
import { classifyIssueText, MissionTypeId } from '../services/classifier';
import { runClientNsfwPreCheck, logBlockedUploadAttempt } from '../services/nsfwFilter';
import { verifyPhotoCategory, recordVerificationOverride, CategoryVerificationResult } from '../services/categoryVerifier';
import { runReportQualityAssist, QualityAssistResult } from '../services/qualityAssist';
import { enhanceLowLightPhoto } from '../services/imageEnhancer';
import { apiFetch } from '../config/apiClient';
import { getUserSession } from '../services/auth';
import { t } from '../config/i18n';


const { width } = Dimensions.get('window');

type FlowState = 'camera' | 'category-picker' | 'confirm' | 'success';

interface MissionType {
  id: MissionTypeId;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface CaptureScreenProps {
  onCaptureSuccess?: () => void;
  initialAssetId?: string;
  initialCategory?: MissionType;
  initialLocation?: { latitude: number; longitude: number };
}

export default function CaptureScreen({
  onCaptureSuccess,
  initialAssetId,
  initialCategory,
  initialLocation,
}: CaptureScreenProps = {}) {
  const { theme } = useTheme();
  const { columns, insets } = useResponsive();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const { pendingCount, isSyncing, triggerSync, refreshPendingCount } = useDraftSync();

  // Flow State: Starts directly on camera for fast reporting!
  const [flowState, setFlowState] = useState<FlowState>('camera');
  const [selectedType, setSelectedType] = useState<MissionType | null>(initialCategory || null);
  const [assetId, setAssetId] = useState<string | null>(initialAssetId || null);

  // Capture Data
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(initialLocation || null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(initialLocation ? 5.0 : null);
  const [notes, setNotes] = useState('');

  // Mandatory Attestation Checkbox
  const [attestationChecked, setAttestationChecked] = useState(false);

  // Voice & Speech State
  const [isListening, setIsListening] = useState(false);
  const [speechLocale, setSpeechLocale] = useState('en-IN');
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [autoClassifiedBadge, setAutoClassifiedBadge] = useState<string | null>(null);

  // Category Verification State (YOLOv8n)
  const [categoryVerification, setCategoryVerification] = useState<CategoryVerificationResult | null>(null);
  const [isVerifyingCategory, setIsVerifyingCategory] = useState(false);
  const [isOverridden, setIsOverridden] = useState(false);

  // Quality Assist & Note Improvement States
  const [qualityResult, setQualityResult] = useState<QualityAssistResult | null>(null);
  const [isSuggestingNote, setIsSuggestingNote] = useState(false);
  const [suggestedNote, setSuggestedNote] = useState<string | null>(null);
  const [qualityDismissed, setQualityDismissed] = useState(false);

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);


  // Structured Audit & Safety Concern States
  const [safetySubtype, setSafetySubtype] = useState<'poor_lighting' | 'broken_streetlight' | 'isolated_stretch' | 'harassment_hotspot' | 'other'>('poor_lighting');
  const [auditLocationType, setAuditLocationType] = useState<string>('public_building');
  const [auditIssueType, setAuditIssueType] = useState<string>('missing_ramp');
  const [auditSeverity, setAuditSeverity] = useState<string>('blocks_access_entirely');

  // Animation values for checkmark screen
  const checkmarkScale = useSharedValue(0);
  const successCircleScale = useSharedValue(0);

  const missionTypes: MissionType[] = [
    {
      id: 'pothole',
      title: 'Pothole',
      icon: <Cone size={24} color={theme.colors.status.rejected} />,
      color: theme.colors.status.rejected,
      bgColor: theme.colors.status.rejectedBg,
    },
    {
      id: 'garbage',
      title: 'Garbage',
      icon: <Trash2 size={24} color={theme.colors.status.pending} />,
      color: theme.colors.status.pending,
      bgColor: theme.colors.status.pendingBg,
    },
    {
      id: 'safety_concern' as any,
      title: "Women's Safety",
      icon: <ShieldAlert size={24} color="#E11D48" />,
      color: '#E11D48',
      bgColor: '#FFE4E6',
    },
    {
      id: 'accessibility',
      title: 'Accessibility Audit',
      icon: <Accessibility size={24} color={theme.colors.status.approved} />,
      color: theme.colors.status.approved,
      bgColor: theme.colors.status.approvedBg,
    },
    {
      id: 'noise',
      title: 'Noise',
      icon: <Volume2 size={24} color={theme.colors.primary} />,
      color: theme.colors.primary,
      bgColor: theme.colors.primaryBg,
    },
    {
      id: 'infrastructure',
      title: 'Infrastructure',
      icon: <Hammer size={24} color={theme.colors.neutral[800]} />,
      color: theme.colors.neutral[800],
      bgColor: theme.colors.neutral[200],
    },
  ];

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getUserSession().then((session) => {
      if (session) setUserId(session.userId);
    });
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: 1,
        },
        (loc) => {
          setGpsAccuracy(loc.coords.accuracy);
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    };

    if (flowState === 'camera') {
      startWatching();
    }

    return () => {
      if (subscription) subscription.remove();
    };
  }, [flowState]);

  const handleStartListening = async () => {
    setSpeechError(null);
    setIsListening(true);
    setVoiceModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await startSpeechRecognition(speechLocale, {
      onResult: (transcript, isFinal) => {
        setNotes(transcript);
        const categoryId = classifyIssueText(transcript);
        if (categoryId !== 'unknown') {
          const match = missionTypes.find((m) => m.id === categoryId);
          if (match) {
            setSelectedType(match);
            setAutoClassifiedBadge(`Auto-classified: ${match.title}`);
          }
        }
        if (isFinal) setIsListening(false);
      },
      onError: (err) => {
        setSpeechError(err);
        setIsListening(false);
      },
      onEnd: () => setIsListening(false),
    });
  };

  const handleStopListening = async () => {
    await stopSpeechRecognition();
    setIsListening(false);
    setVoiceModalVisible(false);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        let actions = [];
        const maxDim = 1600;
        if (photo.width > maxDim || photo.height > maxDim) {
          actions.push({ resize: photo.width > photo.height ? { width: maxDim } : { height: maxDim } });
        }

        let isLowBandwidth = false;
        try {
          const networkState = await Network.getNetworkStateAsync();
          isLowBandwidth = networkState.type === Network.NetworkStateType.CELLULAR;
        } catch (_) {}

        const quality = isLowBandwidth ? 0.5 : 0.7;
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          actions,
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhotoUri(manipulated.uri);

        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setGpsAccuracy(loc.coords.accuracy);
        } catch (_) {}

        setFlowState('category-picker');
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Capture Failed',
        text2: 'Could not snap picture. Please try again.',
      });
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0];
        setPhotoUri(selected.uri);

        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setGpsAccuracy(loc.coords.accuracy);
        } catch (_) {}

        setFlowState('category-picker');
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Gallery Selection Failed',
        text2: 'Could not load image from photo library.',
      });
    }
  };

  const handleSelectCategory = async (item: MissionType) => {
    setSelectedType(item);
    setIsOverridden(false);
    setQualityDismissed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlowState('confirm');

    // Run on-device YOLOv8n category verification if photo exists
    if (photoUri) {
      setIsVerifyingCategory(true);
      try {
        const result = await verifyPhotoCategory(photoUri, item.id);
        setCategoryVerification(result);
      } catch (_) {
        setCategoryVerification(null);
      } finally {
        setIsVerifyingCategory(false);
      }

      // Run on-device Report Quality Assist (blur, darkness, context)
      try {
        const qRes = await runReportQualityAssist(photoUri, item.id, notes);
        setQualityResult(qRes);
      } catch (_) {
        setQualityResult(null);
      }
    }
  };

  const handleSuggestNoteImprovement = async () => {
    if (!selectedType) return;
    setIsSuggestingNote(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await apiFetch('/ai/suggest-note-improvement', {
        method: 'POST',
        body: JSON.stringify({
          note: notes,
          category: selectedType.id,
          user_id: userId || 'anonymous'
        })
      });
      if (res && res.suggested_note) {
        setSuggestedNote(res.suggested_note);
        Toast.show({
          type: 'success',
          text1: 'Suggestion Ready',
          text2: 'Review improved civic phrasing below.',
        });
      }
    } catch (_) {
      // Local deterministic fallback
      const fallbackPhrases: Record<string, string> = {
        pothole: `Road damage: ${notes.trim() || 'pothole'} causing hazardous traffic and vehicle risk.`,
        garbage: `Garbage dump: ${notes.trim() || 'solid waste accumulation'} requiring civic clearance.`,
        safety_concern: `Public safety hazard: ${notes.trim() || 'poor lighting'} endangering evening commuters.`,
        infrastructure: `Damaged civic infrastructure: ${notes.trim() || 'broken asset'} requiring municipal repair.`,
        accessibility: `Accessibility barrier: ${notes.trim() || 'missing ramp/blocked pathway'} obstructing pedestrians.`
      };
      setSuggestedNote(fallbackPhrases[selectedType.id] || `Civic issue: ${notes.trim() || 'requiring inspection'}`);
    } finally {
      setIsSuggestingNote(false);
    }
  };

  const handleOverrideCategory = async () => {
    if (selectedType) {
      await recordVerificationOverride(selectedType.id);
    }
    setIsOverridden(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Toast.show({
      type: 'info',
      text1: 'Override Recorded',
      text2: 'Your report will be flagged for priority human moderation.',
    });
  };

  const handleSubmit = async () => {
    const isSafety = selectedType?.id === ('safety_concern' as any);
    if (!deviceId || (!photoUri && !isSafety) || !location || !selectedType) {
      Toast.show({
        type: 'error',
        text1: 'Missing details',
        text2: 'Complete requirements before submitting.',
      });
      return;
    }

    if (categoryVerification && !categoryVerification.verified && !isOverridden) {
      Toast.show({
        type: 'error',
        text1: 'Category Mismatch',
        text2: 'Please retake the photo or select "This is correct, submit anyway".',
      });
      return;
    }

    if (!attestationChecked) {
      Toast.show({
        type: 'error',
        text1: 'Attestation Required',
        text2: 'Please confirm that this photo is a genuine civic issue.',
      });
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Part 7 Requirement: Automatic on-device photo brightness enhancement for low-light captures
      let finalPhotoUri = photoUri;
      if (photoUri && (qualityResult?.isLowLight || new Date().getHours() < 6 || new Date().getHours() >= 19)) {
        try {
          const enh = await enhanceLowLightPhoto(photoUri);
          if (enh.appliedEnhancement) {
            finalPhotoUri = enh.enhancedUri;
          }
        } catch (_) {}
      }

      // Part 4 Requirement: Run client-side NSFW pre-check BEFORE Cloudinary upload!
      const preCheck = finalPhotoUri ? await runClientNsfwPreCheck(finalPhotoUri) : { passed: true, flagReason: null };
      if (!preCheck.passed) {
        await logBlockedUploadAttempt(userId || 'anonymous', deviceId, preCheck.flagReason || 'Explicit content detected');
        setIsSubmitting(false);
        Toast.show({
          type: 'error',
          text1: 'Upload Blocked',
          text2: 'Image flagged by client content safety filter.',
        });
        return;
      }

      // Write to local SQLite Queue FIRST
      await addDraftReport({
        photo_uri: finalPhotoUri || '',
        transcript: notes.trim(),
        category: selectedType.id,
        latitude: location.latitude,
        longitude: location.longitude,
        asset_id: assetId || undefined,
      });


      await refreshPendingCount();

      let isOnline = false;
      try {
        const netState = await Network.getNetworkStateAsync();
        isOnline = Boolean(netState.isConnected && netState.isInternetReachable);
      } catch (_) {}

      if (isOnline) triggerSync();

      setFlowState('success');
      successCircleScale.value = withSpring(1, { damping: 10, stiffness: 100 });
      checkmarkScale.value = withTiming(1, { duration: 400 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Toast.show({
        type: 'success',
        text1: isOnline ? 'Report Submitted!' : 'Saved Offline!',
        text2: isOnline ? 'Syncing with server...' : 'Report saved safely. Will auto-sync when online.',
      });

      setTimeout(() => {
        setPhotoUri(null);
        setLocation(null);
        setGpsAccuracy(null);
        setNotes('');
        setSelectedType(null);
        setAttestationChecked(false);
        setAutoClassifiedBadge(null);
        setFlowState('camera');
        successCircleScale.value = 0;
        checkmarkScale.value = 0;
        setIsSubmitting(false);
      }, 2500);
    } catch (err: any) {
      setIsSubmitting(false);
      Toast.show({
        type: 'error',
        text1: 'Draft Save Failed',
        text2: err?.message || 'Could not write draft to local queue.',
      });
    }
  };

  const getGpsStatus = () => {
    if (gpsAccuracy === null) return { text: 'Searching...', color: theme.colors.neutral[500] };
    if (gpsAccuracy <= 10) return { text: 'Excellent GPS (<10m)', color: theme.colors.status.approved };
    if (gpsAccuracy <= 25) return { text: 'Good GPS (<25m)', color: theme.colors.status.pending };
    return { text: 'Weak GPS (>25m)', color: theme.colors.status.rejected };
  };

  const gpsStatus = getGpsStatus();

  if (!permission) {
    return <LoadingSpinner fullscreen message="Initializing camera permissions..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.neutral[100] }]}
    >
      {pendingCount > 0 && (
        <Pressable onPress={() => triggerSync()} style={styles.offlineBanner}>
          <CloudOff size={18} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            {pendingCount} report{pendingCount > 1 ? 's' : ''} waiting to sync
          </Text>
          <RefreshCw size={14} color="#FFFFFF" style={isSyncing ? styles.spinningIcon : undefined} />
        </Pressable>
      )}

      {flowState === 'camera' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.cameraHeader}>
              <View style={[styles.gpsBadge, { backgroundColor: 'rgba(15, 23, 42, 0.75)' }]}>
                <Wifi size={14} color={gpsStatus.color} />
                <Text style={[styles.gpsBadgeText, { color: gpsStatus.color }]}>
                  {gpsStatus.text}
                </Text>
              </View>
            </View>

            <View style={styles.cameraFooter}>
              <Text style={styles.cameraInstruction}>
                Point camera at civic issue & snap photo
              </Text>
              <View style={styles.captureRow}>
                <Pressable
                  onPress={pickFromGallery}
                  style={styles.galleryButton}
                  accessibilityLabel="Choose photo from gallery"
                >
                  <ImageIcon size={24} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  onPress={takePhoto}
                  disabled={gpsAccuracy === null}
                  style={({ pressed }) => [
                    styles.captureOuterRing,
                    gpsAccuracy === null && styles.disabledCaptureRing,
                    pressed && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <View style={[styles.captureInnerCircle, gpsAccuracy === null && styles.disabledCaptureCircle]} />
                </Pressable>

                <View style={{ width: 44 }} />
              </View>
            </View>
          </CameraView>
        </Animated.View>
      )}

      {/* Part 4 Requirement: Mandatory Category Tagging immediately after photo capture! */}
      {flowState === 'category-picker' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.content}>
          <ScrollView contentContainerStyle={styles.selectorScroll}>
            <View style={styles.headerSection}>
              <Text style={styles.mainTitle}>Select Issue Category</Text>
              <Text style={styles.subtitle}>
                Mandatory Step: What type of civic issue does this photo show?
              </Text>
            </View>

            <View style={styles.grid}>
              {missionTypes.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectCategory(item)}
                  style={[
                    styles.typeCard,
                    {
                      width: columns >= 3 ? '31%' : '48%',
                      backgroundColor: theme.colors.white,
                      borderColor: theme.colors.neutral[200],
                    },
                  ]}
                >
                  <View style={[styles.typeIconContainer, { backgroundColor: item.bgColor }]}>
                    {item.icon}
                  </View>
                  <Text style={[styles.typeTitle, { color: theme.colors.neutral[800] }]}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {flowState === 'confirm' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.confirmContent}>
          <View style={styles.confirmHeader}>
            <Pressable onPress={() => setFlowState('camera')} style={styles.backTextButton}>
              <ChevronLeft size={20} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Retake</Text>
            </Pressable>
            <Text style={styles.confirmTitle}>Verify & Attest Report</Text>
            <View style={{ width: 80 }} />
          </View>

          <ScrollView style={styles.confirmScroll} contentContainerStyle={styles.confirmScrollContent}>
            <Card style={styles.photoCard} elevation="medium">
              <Image source={{ uri: photoUri || undefined }} style={styles.photoPreview} />
              {selectedType && (
                <View style={styles.confirmBadgeOverlay}>
                  <Badge label={selectedType.title} variant="primary" />
                </View>
              )}
            </Card>

            {/* YOLOv8n Category Verification Feedback */}
            {categoryVerification && !categoryVerification.skipped && (
              <View style={{ marginVertical: 8 }}>
                {categoryVerification.verified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#22C55E' }}>
                    <Badge label={categoryVerification.badge || t('categoryVerified')} variant="approved" />
                    <Text style={{ fontSize: 12, color: '#166534', flex: 1, fontWeight: '500' }}>
                      {categoryVerification.message}
                    </Text>
                  </View>
                ) : isOverridden ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B' }}>
                    <Badge label="Flagged for Review" variant="flagged" />
                    <Text style={{ fontSize: 12, color: '#92400E', flex: 1, fontWeight: '500' }}>
                      Manual override enabled. Report will be prioritized in human moderation queue.
                    </Text>
                  </View>
                ) : (
                  <Card style={{ backgroundColor: '#FEF2F2', borderColor: '#EF4444', borderWidth: 1, padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ShieldAlert size={20} color="#DC2626" />
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#991B1B' }}>
                        {t('categoryMismatchTitle')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 18 }}>
                      {t('categoryMismatchDesc')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <Button
                        title={t('retakePhoto')}
                        onPress={() => setFlowState('camera')}
                        variant="secondary"
                        style={{ flex: 1, height: 40 }}
                      />
                      <Button
                        title={t('overrideAndSubmit')}
                        onPress={handleOverrideCategory}
                        variant="ghost"
                        style={{ flex: 1, height: 40 }}
                      />
                    </View>
                  </Card>
                )}
              </View>
            )}

            {/* On-Device Report Quality Assist Soft Notices */}
            {qualityResult && !qualityResult.passed && !qualityDismissed && (
              <Card style={{ backgroundColor: '#F0F9FF', borderColor: '#0284C7', borderWidth: 1, padding: 14, gap: 8, marginVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Sparkles size={18} color="#0284C7" />
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0369A1' }}>
                      Report Quality Suggestion
                    </Text>
                  </View>
                  <Pressable onPress={() => setQualityDismissed(true)}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Dismiss</Text>
                  </Pressable>
                </View>
                {qualityResult.issues.map((iss, i) => (
                  <View key={i} style={{ gap: 2 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{iss.title}</Text>
                    <Text style={{ fontSize: 11, color: '#475569', lineHeight: 16 }}>{iss.message}</Text>
                    {iss.canAutoEnhance && (
                      <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold', marginTop: 2 }}>
                        ✨ Automatic low-light brightness normalization active.
                      </Text>
                    )}
                  </View>
                ))}
              </Card>
            )}

            {location && (
              <Card style={styles.locationDetailCard} elevation="medium">
                <Text style={styles.sectionHeading}>Location Coordinates</Text>
                <View style={styles.locationRow}>
                  <MapPin size={18} color={theme.colors.primary} />
                  <Text style={{ fontSize: 13 }}>
                    Lat {location.latitude.toFixed(5)}, Lon {location.longitude.toFixed(5)}
                  </Text>
                </View>
              </Card>
            )}

            <Card style={styles.notesCard} elevation="medium">
              <View style={styles.notesHeaderRow}>
                <Text style={styles.sectionHeading}>Description Notes</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {/* Part 5: Optional Server-side Note-Improvement Suggestion */}
                  <Pressable 
                    onPress={handleSuggestNoteImprovement} 
                    style={[styles.inlineMicButton, { backgroundColor: '#EEF2FF', borderColor: '#818CF8' }]}
                    disabled={isSuggestingNote}
                  >
                    <Sparkles size={14} color="#4F46E5" />
                    <Text style={[styles.inlineMicText, { color: '#4F46E5', fontWeight: '700' }]}>
                      {isSuggestingNote ? 'Thinking...' : 'Improve wording?'}
                    </Text>
                  </Pressable>

                  <Pressable onPress={handleStartListening} style={styles.inlineMicButton}>
                    <Mic size={16} color={theme.colors.primary} />
                    <Text style={styles.inlineMicText}>Speak</Text>
                  </Pressable>
                </View>
              </View>

              {autoClassifiedBadge && (
                <View style={{ marginVertical: 4 }}>
                  <Badge label={autoClassifiedBadge} variant="approved" />
                </View>
              )}

              <TextInput
                style={styles.notesInput}
                placeholder="Describe issue by voice or typing..."
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={(txt) => {
                  setNotes(txt);
                  if (suggestedNote) setSuggestedNote(null);
                }}
              />

              {/* Note Improvement Suggestion Review Card */}
              {suggestedNote && (
                <View style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 10, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Wand2 size={16} color="#7C3AED" />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6D28D9' }}>
                      Suggested Civic Phrasing
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#4C1D95', lineHeight: 18, fontStyle: 'italic' }}>
                    &ldquo;{suggestedNote}&rdquo;
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Button
                      title="Use This Phrasing"
                      onPress={() => {
                        setNotes(suggestedNote);
                        setSuggestedNote(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Dismiss"
                      variant="ghost"
                      onPress={() => setSuggestedNote(null)}
                      style={{ flex: 0.6 }}
                    />
                  </View>

                </View>
              )}
            </Card>


            {/* Part 4 Requirement: Mandatory Attestation Checkbox */}
            <Card style={styles.attestationCard} elevation="medium">
              <Pressable
                onPress={() => setAttestationChecked(!attestationChecked)}
                style={styles.attestationRow}
              >
                {attestationChecked ? (
                  <CheckSquare size={22} color={theme.colors.primary} />
                ) : (
                  <Square size={22} color={theme.colors.neutral[400]} />
                )}
                <Text style={styles.attestationText}>
                  I confirm this photo is a genuine civic issue and does not contain people, private property without consent, or inappropriate content.
                </Text>
              </Pressable>
            </Card>

            <Button
              title={isSubmitting ? 'Submitting...' : 'Submit Genuine Report'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!attestationChecked || isSubmitting}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </Animated.View>
      )}

      {flowState === 'success' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.successScreen}>
          <Animated.View style={styles.successOuterCircle}>
            <Animated.View style={styles.successInnerCheck}>
              <Check size={48} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          </Animated.View>
          <Text style={styles.successHeading}>Report Recorded!</Text>
          <Text style={styles.successSubtext}>
            Thank you for contributing to responsible civic reporting.
          </Text>
        </Animated.View>
      )}

      {/* Voice Modal */}
      <Modal visible={voiceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Globe size={20} color={theme.colors.primary} />
              <Text style={{ fontWeight: 'bold' }}>Speech Recognition</Text>
            </View>

            <View style={styles.localeRow}>
              {SUPPORTED_LOCALES.map((loc) => (
                <Pressable
                  key={loc.code}
                  onPress={() => setSpeechLocale(loc.code)}
                  style={[styles.localeChip, speechLocale === loc.code && styles.localeChipActive]}
                >
                  <Text style={[styles.localeChipText, speechLocale === loc.code && styles.localeChipTextActive]}>
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.listeningCircleContainer}>
              <View style={[styles.listeningPulseCircle, isListening && styles.pulseActive]}>
                <Mic size={36} color="#FFFFFF" />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
                {isListening ? 'Listening... Speak now' : 'Processing...'}
              </Text>
            </View>

            {speechError && <Text style={styles.errorTextModal}>{speechError}</Text>}

            <Button title="Done Speaking" onPress={handleStopListening} style={{ width: '100%', marginTop: 12 }} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  spinningIcon: {
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  selectorScroll: {
    padding: baseTheme.spacing[24],
    flexGrow: 1,
  },
  headerSection: {
    marginTop: baseTheme.spacing[16],
    marginBottom: baseTheme.spacing[16],
  },
  mainTitle: {
    fontSize: baseTheme.typography.fontSizes.xxl,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[8],
  },
  subtitle: {
    fontSize: baseTheme.typography.fontSizes.md,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: baseTheme.spacing[16],
    justifyContent: 'space-between',
  },
  typeCard: {
    borderRadius: baseTheme.radius.lg,
    padding: baseTheme.spacing[16],
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...baseTheme.shadows.low,
    marginBottom: baseTheme.spacing[4],
  },
  typeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: baseTheme.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: baseTheme.spacing[12],
  },
  typeTitle: {
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.semibold,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: baseTheme.spacing[16],
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: baseTheme.spacing[12],
    paddingVertical: baseTheme.spacing[4],
    borderRadius: baseTheme.radius.round,
  },
  gpsBadgeText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  cameraFooter: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: baseTheme.spacing[32],
    paddingHorizontal: baseTheme.spacing[24],
    alignItems: 'center',
    borderTopLeftRadius: baseTheme.radius.xl,
    borderTopRightRadius: baseTheme.radius.xl,
  },
  cameraInstruction: {
    color: '#FFFFFF',
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.medium,
    marginBottom: baseTheme.spacing[24],
    textAlign: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledCaptureRing: {
    borderColor: '#64748B',
    opacity: 0.5,
  },
  captureInnerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  disabledCaptureCircle: {
    backgroundColor: '#64748B',
  },
  confirmContent: {
    flex: 1,
  },
  confirmHeader: {
    height: Platform.OS === 'ios' ? 100 : 70,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: baseTheme.spacing[16],
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    height: 44,
  },
  confirmTitle: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  confirmScroll: {
    flex: 1,
  },
  confirmScrollContent: {
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
  },
  photoCard: {
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: baseTheme.radius.md,
  },
  confirmBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  locationDetailCard: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesCard: {
    gap: 8,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineMicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  inlineMicText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  attestationCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: 12,
  },
  attestationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  attestationText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successOuterCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successInnerCheck: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHeading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#64748B',
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
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  localeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 24,
  },
  localeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  localeChipActive: {
    backgroundColor: '#2563EB',
  },
  localeChipText: {
    fontSize: 12,
    color: '#475569',
  },
  localeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listeningCircleContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  listeningPulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pulseActive: {
    backgroundColor: '#DC2626',
  },
  errorTextModal: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
});
