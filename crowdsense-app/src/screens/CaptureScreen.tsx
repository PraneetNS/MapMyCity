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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Network from 'expo-network';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import MapView, { Marker } from 'react-native-maps';
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
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Badge, LoadingSpinner } from '../components';
import { submitPothole } from '../services/submissions';
import { getDeviceId } from '../utils/device';

const { width } = Dimensions.get('window');

type FlowState = 'type-selector' | 'camera' | 'confirm' | 'success';

interface MissionType {
  id: 'pothole' | 'garbage' | 'noise' | 'accessibility' | 'infrastructure';
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export default function CaptureScreen() {
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  // Flow State
  const [flowState, setFlowState] = useState<FlowState>('type-selector');
  const [selectedType, setSelectedType] = useState<MissionType | null>(null);

  // Capture Data
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Animation values for checkmark screen
  const checkmarkScale = useSharedValue(0);
  const successCircleScale = useSharedValue(0);

  // Mission types config with dynamic theme colors for WCAG contrast compliance
  const missionTypes: MissionType[] = [
    {
      id: 'pothole',
      title: 'Pothole',
      icon: <Cone size={24} color={theme.colors.status.rejected} accessibilityLabel="Pothole icon" />,
      color: theme.colors.status.rejected,
      bgColor: theme.colors.status.rejectedBg,
    },
    {
      id: 'garbage',
      title: 'Garbage',
      icon: <Trash2 size={24} color={theme.colors.status.pending} accessibilityLabel="Garbage icon" />,
      color: theme.colors.status.pending,
      bgColor: theme.colors.status.pendingBg,
    },
    {
      id: 'noise',
      title: 'Noise',
      icon: <Volume2 size={24} color={theme.colors.primary} accessibilityLabel="Noise icon" />,
      color: theme.colors.primary,
      bgColor: theme.colors.primaryBg,
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      icon: <Accessibility size={24} color={theme.colors.status.approved} accessibilityLabel="Accessibility icon" />,
      color: theme.colors.status.approved,
      bgColor: theme.colors.status.approvedBg,
    },
    {
      id: 'infrastructure',
      title: 'Infrastructure',
      icon: <Hammer size={24} color={theme.colors.status.flagged} accessibilityLabel="Infrastructure icon" />,
      color: theme.colors.status.flagged,
      bgColor: theme.colors.status.flaggedBg,
    },
  ];

  // Dynamic style mappings
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.neutral[100],
    },
    mainTitle: {
      color: theme.colors.neutral[900],
    },
    subtitle: {
      color: theme.colors.neutral[600],
    },
    typeCard: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
    typeTitle: {
      color: theme.colors.neutral[800],
    },
    backButtonText: {
      color: theme.colors.primary,
    },
    confirmTitle: {
      color: theme.colors.neutral[900],
    },
    confirmHeader: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
    confirmContent: {
      backgroundColor: theme.colors.neutral[100],
    },
    locationCoordinates: {
      color: theme.colors.neutral[800],
    },
    notesInput: {
      borderColor: theme.colors.neutral[200],
      color: theme.colors.neutral[800],
      backgroundColor: theme.colors.neutral[100],
    },
    progressBarBg: {
      backgroundColor: theme.colors.neutral[300],
    },
    progressText: {
      color: theme.colors.neutral[600],
    },
    successScreen: {
      backgroundColor: theme.colors.white,
    },
    successOuterCircle: {
      backgroundColor: theme.colors.status.approvedBg,
    },
    successInnerCheck: {
      backgroundColor: theme.colors.status.approved,
    },
    successHeading: {
      color: theme.colors.neutral[900],
    },
    successSubtext: {
      color: theme.colors.neutral[500],
    },
  });

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  // Watch location when camera is active to calculate accuracy and lock early GPS coordinate
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
      if (subscription) {
        subscription.remove();
      }
    };
  }, [flowState]);

  // Handle camera capture click
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        // Run compression and resizing client-side immediately
        let actions = [];
        const maxDim = 1600;
        if (photo.width > maxDim || photo.height > maxDim) {
          if (photo.width > photo.height) {
            actions.push({ resize: { width: maxDim } });
          } else {
            actions.push({ resize: { height: maxDim } });
          }
        }

        // Detect connection type via expo-network
        let isLowBandwidth = false;
        try {
          const networkState = await Network.getNetworkStateAsync();
          isLowBandwidth = networkState.type === Network.NetworkStateType.CELLULAR;
        } catch (netErr) {
          console.log('Failed to check network state:', netErr);
        }

        // Reduce image quality further if on slow/cellular network (50% quality vs 70% quality)
        const quality = isLowBandwidth ? 0.5 : 0.7;

        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          actions,
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhotoUri(manipulated.uri);
        
        // Try to get a high accuracy final location snapshot
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          setGpsAccuracy(loc.coords.accuracy);
        } catch (_) {
          // Keep the watched location if snapshot fails
        }
        
        setFlowState('confirm');
      }
    } catch (err) {
      console.error(err);
      Toast.show({
        type: 'error',
        text1: 'Capture Failed',
        text2: 'Could not snap the picture. Please try again.',
      });
    }
  };

  // Submit data
  const handleSubmit = async () => {
    if (!deviceId || !photoUri || !location || !selectedType) {
      Toast.show({
        type: 'error',
        text1: 'Missing details',
        text2: 'Complete capture requirements before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await submitPothole({
        deviceId,
        photoUri,
        latitude: location.latitude,
        longitude: location.longitude,
        capturedAt: new Date().toISOString(),
        missionType: selectedType.id,
        notes: notes.trim(),
        onProgress: (pct) => {
          setUploadProgress(pct);
        },
      });

      // Show success screen and trigger animation
      setFlowState('success');
      successCircleScale.value = withSpring(1, { damping: 10, stiffness: 100 });
      checkmarkScale.value = withTiming(1, { duration: 400 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Toast.show({
        type: 'success',
        text1: 'Report Submitted!',
        text2: 'Thank you for keeping our city clean.',
      });

      // Reset states and go back to selector after 2.5 seconds
      setTimeout(() => {
        setPhotoUri(null);
        setLocation(null);
        setGpsAccuracy(null);
        setNotes('');
        setSelectedType(null);
        setFlowState('type-selector');
        successCircleScale.value = 0;
        checkmarkScale.value = 0;
      }, 2500);
    } catch (err: any) {
      setIsSubmitting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: err?.message || 'Please check your connection and retry.',
      });
    }
  };

  const getGpsStatus = () => {
    if (gpsAccuracy === null) return { text: 'Searching...', color: theme.colors.neutral[500] };
    if (gpsAccuracy <= 10) return { text: 'Excellent GPS (Accuracy: <10m)', color: theme.colors.status.approved };
    if (gpsAccuracy <= 25) return { text: 'Good GPS (Accuracy: <25m)', color: theme.colors.status.pending };
    return { text: 'Weak GPS (Accuracy: >25m)', color: theme.colors.status.rejected };
  };

  const gpsStatus = getGpsStatus();

  // Animations for type selection cards
  const TypeCard = ({ item }: { item: MissionType }) => {
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      scale.value = withSpring(0.95, {}, () => {
        scale.value = withSpring(1);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedType(item);
      
      // Request camera permissions or go to camera state
      if (!permission?.granted) {
        requestPermission().then((res) => {
          if (res.granted) {
            setFlowState('camera');
          } else {
            Toast.show({
              type: 'error',
              text1: 'Camera access denied',
              text2: 'Grant camera access to report civic issues.',
            });
          }
        });
      } else {
        setFlowState('camera');
      }
    };

    return (
      <Pressable 
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Report issue category: ${item.title}`}
        accessibilityHint="Selects issue type and triggers camera scanner"
      >
        <Animated.View style={[styles.typeCard, dynamicStyles.typeCard, animatedStyle]}>
          <View style={[styles.typeIconContainer, { backgroundColor: item.bgColor }]}>
            {item.icon}
          </View>
          <Text style={[styles.typeTitle, dynamicStyles.typeTitle]}>{item.title}</Text>
        </Animated.View>
      </Pressable>
    );
  };

  if (!permission) {
    return <LoadingSpinner fullscreen message="Initializing camera permissions..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, dynamicStyles.container]}
    >
      {flowState === 'type-selector' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.content}>
          <ScrollView contentContainerStyle={styles.selectorScroll}>
            <View style={styles.headerSection}>
              <Text style={[styles.mainTitle, dynamicStyles.mainTitle]}>Report an Issue</Text>
              <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Select the category that best describes the civic problem</Text>
            </View>
            <View style={styles.grid}>
              {missionTypes.map((item) => (
                <TypeCard key={item.id} item={item} />
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {flowState === 'camera' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            {/* Top Bar Overlay */}
            <View style={styles.cameraHeader}>
              <Pressable
                onPress={() => setFlowState('type-selector')}
                accessibilityRole="button"
                accessibilityLabel="Go back to issue selector"
                accessibilityHint="Returns to issue category selection screen"
                style={styles.backIconButton}
              >
                <ChevronLeft size={24} color={theme.colors.white} accessibilityLabel="Back chevron" />
              </Pressable>
              
              <View 
                style={[styles.gpsBadge, { backgroundColor: 'rgba(15, 23, 42, 0.75)' }]}
                accessibilityLabel={`GPS signal status: ${gpsStatus.text}`}
              >
                <Wifi size={14} color={gpsStatus.color} accessibilityLabel="GPS connection status icon" />
                <Text style={[styles.gpsBadgeText, { color: gpsStatus.color }]}>
                  {gpsStatus.text}
                </Text>
              </View>
            </View>

            {/* Bottom Bar Overlay */}
            <View style={styles.cameraFooter}>
              <Text 
                style={styles.cameraInstruction}
                accessibilityLabel={`Position the ${selectedType?.title.toLowerCase()} inside the frame and snap`}
              >
                Position the {selectedType?.title.toLowerCase()} inside the frame and snap
              </Text>
              <View style={styles.captureRow}>
                <Pressable
                  onPress={takePhoto}
                  disabled={gpsAccuracy === null}
                  accessibilityRole="button"
                  accessibilityLabel="Take Photo"
                  accessibilityHint={gpsAccuracy === null ? "Waiting for location connection" : "Takes a picture of the report report"}
                  style={({ pressed }) => [
                    styles.captureOuterRing,
                    gpsAccuracy === null && styles.disabledCaptureRing,
                    pressed && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <View style={[styles.captureInnerCircle, gpsAccuracy === null && styles.disabledCaptureCircle]} />
                </Pressable>
              </View>
            </View>
          </CameraView>
        </Animated.View>
      )}

      {flowState === 'confirm' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.confirmContent, dynamicStyles.confirmContent]}>
          <View style={[styles.confirmHeader, dynamicStyles.confirmHeader]}>
            <Pressable 
              onPress={() => setFlowState('camera')} 
              accessibilityRole="button"
              accessibilityLabel="Retake Photo"
              accessibilityHint="Re-opens the camera screen to take a new picture"
              style={styles.backTextButton}
            >
              <ChevronLeft size={20} color={theme.colors.primary} accessibilityLabel="Chevron left icon" />
              <Text style={[styles.backButtonText, dynamicStyles.backButtonText]}>Retake</Text>
            </Pressable>
            <Text style={[styles.confirmTitle, dynamicStyles.confirmTitle]}>Verify Report</Text>
            <View style={{ width: 80 }} />
          </View>

          <ScrollView
            style={styles.confirmScroll}
            contentContainerStyle={styles.confirmScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo Preview Card */}
            <Card style={styles.photoCard} elevation="medium">
              <Image source={{ uri: photoUri || undefined }} style={styles.photoPreview} accessibilityLabel="Scanned civic report photo preview" />
              {selectedType && (
                <View style={styles.confirmBadgeOverlay}>
                  <Badge label={selectedType.title} variant={selectedType.id === 'pothole' ? 'rejected' : selectedType.id === 'garbage' ? 'pending' : 'primary'} />
                </View>
              )}
            </Card>

            {/* Location Card with Map Thumbnail */}
            {location && (
              <Card style={styles.locationDetailCard} elevation="medium">
                <Text style={styles.sectionHeading}>Location Details</Text>
                
                <View style={styles.locationRow}>
                  <MapPin size={18} color={theme.colors.primary} accessibilityLabel="Map pin icon" />
                  <Text style={[styles.locationCoordinates, dynamicStyles.locationCoordinates]}>
                    Lat {location.latitude.toFixed(5)}, Lon {location.longitude.toFixed(5)}
                  </Text>
                </View>

                {gpsAccuracy && (
                  <View style={styles.gpsAccuracyConfirm}>
                    <Info size={14} color={gpsStatus.color} accessibilityLabel="Accuracy info icon" />
                    <Text style={[styles.accuracyTextConfirm, { color: gpsStatus.color }]}>
                      Accuracy guaranteed within {Math.round(gpsAccuracy)}m
                    </Text>
                  </View>
                )}

                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.thumbnailMap}
                    initialRegion={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    accessibilityLabel="Location map preview"
                  >
                    <Marker
                      coordinate={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }}
                      pinColor={selectedType?.color || theme.colors.primary}
                    />
                  </MapView>
                </View>
              </Card>
            )}

            {/* Report Notes */}
            <Card style={styles.notesCard} elevation="medium">
              <Text style={styles.sectionHeading}>Report Notes</Text>
              <TextInput
                style={[styles.notesInput, dynamicStyles.notesInput]}
                placeholder="Describe the issue, severity, or landmarks (e.g. Near the bus stop, blocking bike lane)..."
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                accessibilityLabel="Enter optional description notes for this report"
                accessibilityHint="Optional contextual details"
              />
            </Card>

            {/* Progress bar */}
            {isSubmitting && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBarBg, dynamicStyles.progressBarBg]}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={[styles.progressText, dynamicStyles.progressText]}>
                  {uploadProgress < 100 ? `Uploading Photo: ${uploadProgress}%` : 'Finalizing Submission...'}
                </Text>
              </View>
            )}

            {/* Actions */}
            <Button
              title={isSubmitting ? 'Submitting...' : 'Submit Report'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
            />
          </ScrollView>
        </Animated.View>
      )}

      {flowState === 'success' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.successScreen, dynamicStyles.successScreen]}>
          <Animated.View
            style={[
              styles.successOuterCircle,
              dynamicStyles.successOuterCircle,
              useAnimatedStyle(() => ({
                transform: [{ scale: successCircleScale.value }],
              })),
            ]}
          >
            <Animated.View
              style={[
                styles.successInnerCheck,
                dynamicStyles.successInnerCheck,
                useAnimatedStyle(() => ({
                  transform: [{ scale: checkmarkScale.value }],
                })),
              ]}
            >
              <Check size={48} color={theme.colors.white} strokeWidth={3} accessibilityLabel="Success Checkmark icon" />
            </Animated.View>
          </Animated.View>
          <Text style={[styles.successHeading, dynamicStyles.successHeading]}>Report Submitted!</Text>
          <Text style={[styles.successSubtext, dynamicStyles.successSubtext]}>
            Your civic report has been received and queued for review.
          </Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  selectorScroll: {
    padding: baseTheme.spacing[24],
    flexGrow: 1,
  },
  headerSection: {
    marginTop: baseTheme.spacing[24],
    marginBottom: baseTheme.spacing[32],
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
    width: (width - 48 - 16) / 2,
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
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: baseTheme.spacing[16],
  },
  backIconButton: {
    width: 44, // 44px touch target
    height: 44, // 44px touch target
    borderRadius: baseTheme.radius.round,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  backTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    height: 44, // 44px touch target height
  },
  backButtonText: {
    fontWeight: baseTheme.typography.fontWeights.semibold,
    fontSize: baseTheme.typography.fontSizes.sm,
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
    paddingBottom: 40,
  },
  photoCard: {
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
    height: 280,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  confirmBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  locationDetailCard: {
    gap: baseTheme.spacing[8],
  },
  sectionHeading: {
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.bold,
    color: '#64748B', // neutral 500 equivalent, solid WCAG AA check
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: baseTheme.spacing[4],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.spacing[8],
  },
  locationCoordinates: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.semibold,
  },
  gpsAccuracyConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accuracyTextConfirm: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.medium,
  },
  mapContainer: {
    height: 120,
    width: '100%',
    borderRadius: baseTheme.radius.md,
    overflow: 'hidden',
    marginTop: baseTheme.spacing[8],
  },
  thumbnailMap: {
    ...StyleSheet.absoluteFill,
  },
  notesCard: {
    gap: baseTheme.spacing[8],
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: baseTheme.radius.sm,
    padding: baseTheme.spacing[12],
    fontSize: baseTheme.typography.fontSizes.sm,
    textAlignVertical: 'top',
    height: 90,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: baseTheme.spacing[8],
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: baseTheme.radius.round,
    overflow: 'hidden',
    marginBottom: baseTheme.spacing[8],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: baseTheme.radius.round,
  },
  progressText: {
    fontSize: baseTheme.typography.fontSizes.xs,
    fontWeight: baseTheme.typography.fontWeights.semibold,
  },
  submitButton: {
    marginTop: baseTheme.spacing[8],
  },
  successScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[32],
  },
  successOuterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: baseTheme.spacing[24],
    ...baseTheme.shadows.low,
  },
  successInnerCheck: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...baseTheme.shadows.medium,
  },
  successHeading: {
    fontSize: baseTheme.typography.fontSizes.xl,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[12],
  },
  successSubtext: {
    fontSize: baseTheme.typography.fontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: baseTheme.spacing[24],
  },
});
