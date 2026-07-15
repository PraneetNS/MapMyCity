import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Activity,
  Play,
  Square,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Clock,
  Compass,
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Badge, LoadingSpinner } from '../components';
import { apiFetch } from '../config/apiClient';
import { getDeviceId } from '../utils/device';

const { width } = Dimensions.get('window');
const WINDOW_SIZE = 20; // 1 second of data at 20Hz (50ms interval)

interface RoughPatch {
  latitude: number;
  longitude: number;
  intensity: number;
  captured_at: string;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RideModeScreen() {
  const { theme, isDark } = useTheme();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Logging States
  const [isLogging, setIsLogging] = useState(false);
  const [roughPatches, setRoughPatches] = useState<RoughPatch[]>([]);
  const [distanceCovered, setDistanceCovered] = useState(0); // in meters
  const [rideDuration, setRideDuration] = useState(0); // in seconds
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Post-ride Summary
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    distance: number;
    patchesCount: number;
    duration: number;
  } | null>(null);

  // Sensor Refs
  const readings = useRef<{ x: number; y: number; z: number }[]>([]);
  const lastBumpTimeRef = useRef<number>(0);
  const currentLocRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastLocRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Subscriptions
  const accelSubRef = useRef<any>(null);
  const locSubRef = useRef<any>(null);

  // Animations
  const pulseScale = useSharedValue(1);

  const activeIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Mission types config with dynamic theme colors for WCAG contrast compliance
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.neutral[100],
    },
    headerCard: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
    mainTitle: {
      color: theme.colors.neutral[900],
    },
    subtitle: {
      color: theme.colors.neutral[600],
    },
    statValue: {
      color: theme.colors.neutral[900],
    },
    statLabel: {
      color: theme.colors.neutral[500],
    },
    buttonStart: {
      backgroundColor: theme.colors.primary,
    },
    activeHeader: {
      backgroundColor: theme.colors.primaryBg,
      borderColor: theme.colors.primary,
    },
    activeTitle: {
      color: theme.colors.primary,
    },
    activePulse: {
      backgroundColor: theme.colors.primary,
    },
  });

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    return () => {
      stopLogging(true);
    };
  }, []);

  const startLogging = async () => {
    // Request location permission first
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert('Location permission is required to tag detected road anomalies.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLogging(true);
    setRoughPatches([]);
    setDistanceCovered(0);
    setRideDuration(0);
    setShowSummary(false);
    
    // Clear refs
    readings.current = [];
    lastBumpTimeRef.current = 0;
    currentLocRef.current = null;
    lastLocRef.current = null;

    // Start pulsing indicator
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
      true
    );

    // 1. Subscribe to Location updates
    locSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1500,
        distanceInterval: 2,
      },
      (loc) => {
        setGpsAccuracy(loc.coords.accuracy);
        currentLocRef.current = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        if (lastLocRef.current) {
          const dist = haversineDistance(
            lastLocRef.current.latitude,
            lastLocRef.current.longitude,
            loc.coords.latitude,
            loc.coords.longitude
          );
          setDistanceCovered((prev) => prev + dist);
        }
        lastLocRef.current = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }
    );

    // 2. Subscribe to Accelerometer
    Accelerometer.setUpdateInterval(50); // 20 Hz
    accelSubRef.current = Accelerometer.addListener((data) => {
      readings.current.push({ x: data.x, y: data.y, z: data.z });
      if (readings.current.length > WINDOW_SIZE) {
        readings.current.shift();
      }

      if (readings.current.length >= WINDOW_SIZE) {
        // Calculate rolling means
        const count = readings.current.length;
        const meanX = readings.current.reduce((sum, r) => sum + r.x, 0) / count;
        const meanY = readings.current.reduce((sum, r) => sum + r.y, 0) / count;
        const meanZ = readings.current.reduce((sum, r) => sum + r.z, 0) / count;

        // Calculate variance on XY axes to detect phone handling/movement
        const varX = readings.current.reduce((sum, r) => sum + Math.pow(r.x - meanX, 2), 0) / count;
        const varY = readings.current.reduce((sum, r) => sum + Math.pow(r.y - meanY, 2), 0) / count;
        const stdDevXY = Math.sqrt(varX + varY);

        // Filter phone-handling noise vs road jolts.
        // Handling standard dev is typically > 0.12G. If it's too high, phone is actively shaking/turning.
        if (stdDevXY <= 0.12) {
          const deviation = Math.abs(data.z - meanZ);
          
          // Spike threshold is set at 0.45G
          if (deviation > 0.45) {
            const now = Date.now();
            // Debounce jolt detections to avoid multiple counts on the same pothole
            if (now - lastBumpTimeRef.current > 500) {
              lastBumpTimeRef.current = now;
              if (currentLocRef.current) {
                const patch: RoughPatch = {
                  latitude: currentLocRef.current.latitude,
                  longitude: currentLocRef.current.longitude,
                  intensity: deviation,
                  captured_at: new Date().toISOString(),
                };
                setRoughPatches((prev) => [...prev, patch]);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
            }
          }
        }
      }
    });

    // 3. Start Ride duration timer
    timerIntervalRef.current = setInterval(() => {
      setRideDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopLogging = async (isDiscard = false) => {
    // 1. Remove subscriptions
    if (accelSubRef.current) {
      accelSubRef.current.remove();
      accelSubRef.current = null;
    }
    if (locSubRef.current) {
      locSubRef.current.remove();
      locSubRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    pulseScale.value = 1;
    setIsLogging(false);

    if (isDiscard) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Save summary stats before resetting
    const finalDist = distanceCovered;
    const finalPatches = roughPatches.length;
    const finalDur = rideDuration;

    setSummaryData({
      distance: finalDist,
      patchesCount: finalPatches,
      duration: finalDur,
    });
    setShowSummary(true);

    // 2. Batch-upload passive road quality submissions to the FastAPI backend
    if (roughPatches.length > 0 && deviceId) {
      try {
        await apiFetch('/submissions/passive-batch', {
          method: 'POST',
          body: JSON.stringify({
            device_id: deviceId,
            jolts: roughPatches.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              intensity: p.intensity,
              captured_at: p.captured_at,
            })),
            notes: `Passive log duration: ${finalDur}s, distance: ${finalDist.toFixed(1)}m.`,
          }),
        });
      } catch (err) {
        console.error('Failed to upload road quality batch:', err);
      }
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={styles.content}>
      <View style={[styles.headerCard, dynamicStyles.headerCard]}>
        <Activity size={32} color={theme.colors.primary} style={styles.headerIcon} />
        <Text style={[styles.mainTitle, dynamicStyles.mainTitle]}>Ride Mode</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Anonymously map rough roads and potholes while you ride using your phone's accelerometer sensors.
        </Text>
      </View>

      {isLogging ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.loggingBox, dynamicStyles.activeHeader]}>
          <View style={styles.activeRow}>
            <Animated.View style={[styles.pulseCircle, dynamicStyles.activePulse, activeIndicatorStyle]} />
            <Text style={[styles.activeText, dynamicStyles.activeTitle]}>Ride Logging Active</Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, dynamicStyles.statValue]}>
                {formatDuration(rideDuration)}
              </Text>
              <Text style={[styles.metricLabel, dynamicStyles.statLabel]}>Duration</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, dynamicStyles.statValue]}>
                {(distanceCovered / 1000).toFixed(2)} km
              </Text>
              <Text style={[styles.metricLabel, dynamicStyles.statLabel]}>Distance</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: theme.colors.status.rejected }]}>
                {roughPatches.length}
              </Text>
              <Text style={[styles.metricLabel, dynamicStyles.statLabel]}>Jolts Detected</Text>
            </View>
          </View>

          {gpsAccuracy !== null && (
            <View style={styles.gpsRow}>
              <Compass size={14} color={theme.colors.neutral[500]} />
              <Text style={[styles.gpsText, dynamicStyles.statLabel]}>
                GPS Accuracy: {gpsAccuracy.toFixed(1)}m
              </Text>
            </View>
          )}

          <Button
            title="End Ride & Save"
            onPress={() => stopLogging(false)}
            variant="danger"
            style={styles.actionBtn}
            icon={<Square size={16} color={theme.colors.white} />}
          />
        </Animated.View>
      ) : (
        <View style={styles.setupBox}>
          <View style={styles.instructionsContainer}>
            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: theme.colors.primaryBg }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.neutral[700] }]}>
                Mount your phone securely in a bike bracket or vehicle dashboard holder.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: theme.colors.primaryBg }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.neutral[700] }]}>
                Tap 'Start Ride' before beginning your route.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: theme.colors.primaryBg }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.neutral[700] }]}>
                Sensor readings filter phone placement noise and only log genuine road jolts.
              </Text>
            </View>
          </View>

          <Button
            title="Start Ride"
            onPress={startLogging}
            variant="primary"
            style={styles.actionBtn}
            icon={<Play size={16} color={theme.colors.white} />}
          />
        </View>
      )}

      {showSummary && summaryData && (
        <Animated.View entering={FadeIn} style={styles.summaryContainer}>
          <Card style={StyleSheet.flatten([styles.summaryCard, { borderColor: theme.colors.status.approved }])}>
            <Badge label="Ride Completed" variant="approved" style={styles.summaryBadge} />
            <Text style={[styles.summaryTitle, { color: theme.colors.neutral[900] }]}>Ride Summary</Text>
            
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatItem}>
                <Clock size={20} color={theme.colors.neutral[600]} />
                <View>
                  <Text style={[styles.summaryStatVal, { color: theme.colors.neutral[800] }]}>
                    {formatDuration(summaryData.duration)}
                  </Text>
                  <Text style={[styles.summaryStatLbl, { color: theme.colors.neutral[500] }]}>Total Time</Text>
                </View>
              </View>

              <View style={styles.summaryStatItem}>
                <MapPin size={20} color={theme.colors.neutral[600]} />
                <View>
                  <Text style={[styles.summaryStatVal, { color: theme.colors.neutral[800] }]}>
                    {(summaryData.distance / 1000).toFixed(2)} km
                  </Text>
                  <Text style={[styles.summaryStatLbl, { color: theme.colors.neutral[500] }]}>Distance</Text>
                </View>
              </View>

              <View style={styles.summaryStatItem}>
                <AlertTriangle size={20} color={theme.colors.status.rejected} />
                <View>
                  <Text style={[styles.summaryStatVal, { color: theme.colors.status.rejected }]}>
                    {summaryData.patchesCount} jolts
                  </Text>
                  <Text style={[styles.summaryStatLbl, { color: theme.colors.neutral[500] }]}>Rough patches</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.summaryFootnote, { color: theme.colors.neutral[500] }]}>
              Batch of {summaryData.patchesCount} jolts successfully reported to server! Spikes require corroboration from independent contributors over the same stretch before mapping.
            </Text>
          </Card>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
  },
  headerIcon: {
    marginBottom: baseTheme.spacing[8],
  },
  headerCard: {
    padding: 20,
    borderRadius: baseTheme.radius.lg,
    borderWidth: 1,
    ...baseTheme.shadows.low,
  },
  mainTitle: {
    fontSize: baseTheme.typography.fontSizes.xl,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  subtitle: {
    fontSize: baseTheme.typography.fontSizes.sm,
    lineHeight: 20,
    marginTop: baseTheme.spacing[8],
  },
  loggingBox: {
    borderRadius: baseTheme.radius.lg,
    borderWidth: 1,
    padding: 20,
    gap: baseTheme.spacing[16],
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.spacing[8],
  },
  pulseCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  activeText: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: baseTheme.spacing[12],
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: baseTheme.radius.md,
    padding: baseTheme.spacing[12],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  metricValue: {
    fontSize: baseTheme.typography.fontSizes.lg,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  metricLabel: {
    fontSize: baseTheme.typography.fontSizes.xs,
    marginTop: 4,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gpsText: {
    fontSize: baseTheme.typography.fontSizes.xs,
  },
  setupBox: {
    gap: baseTheme.spacing[16],
  },
  instructionsContainer: {
    gap: baseTheme.spacing[12],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.spacing[12],
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: baseTheme.typography.fontSizes.sm,
    lineHeight: 18,
  },
  actionBtn: {
    width: '100%',
    height: 48,
    marginTop: 8,
  },
  summaryContainer: {
    marginTop: baseTheme.spacing[8],
  },
  summaryCard: {
    padding: 20,
    borderWidth: 2,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    marginBottom: baseTheme.spacing[8],
  },
  summaryTitle: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[16],
  },
  summaryStats: {
    gap: baseTheme.spacing[12],
    marginBottom: baseTheme.spacing[16],
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.spacing[12],
  },
  summaryStatVal: {
    fontSize: baseTheme.typography.fontSizes.md,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  summaryStatLbl: {
    fontSize: baseTheme.typography.fontSizes.xs,
    marginTop: 2,
  },
  summaryFootnote: {
    fontSize: baseTheme.typography.fontSizes.xs,
    lineHeight: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: baseTheme.spacing[12],
  },
});
