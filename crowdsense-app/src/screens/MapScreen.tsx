import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  Modal,
} from 'react-native';
import MapView from 'react-native-map-clustering';
import { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import {
  Locate,
  Cone,
  Trash2,
  Volume2,
  Accessibility,
  Hammer,
  Clock,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Flag,
  Eye,
  Bell,
  ThumbsUp,
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { fetchApprovedSubmissionsInBounds, flagSubmission } from '../services/submissions';
import type { Submission } from '../types';
import { Card, Badge, StatusIndicator, Skeleton, Button } from '../components';
import { StatusTimeline } from '../components/StatusTimeline';
import { HazardReportModal, HAZARD_TYPES } from '../components/HazardReportModal';
import { subscribeToMapChanges, subscribeToViewportPresence } from '../services/realtime';
import { getOrInitializeLiteMode } from '../services/liteMode';
import { apiFetch } from '../config/apiClient';

const { width, height } = Dimensions.get('window');

const defaultRegion = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Pulsing Marker Component for newly added pins
const PulseMarker = ({
  color,
  icon,
  isNew,
}: {
  color: string;
  icon: React.ReactNode;
  isNew: boolean;
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (isNew) {
      scale.value = withRepeat(
        withSequence(withTiming(1.4, { duration: 1000 }), withTiming(1, { duration: 1000 })),
        -1,
        true
      );
      opacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 1000 }), withTiming(0.4, { duration: 1000 })),
        -1,
        true
      );
    }
  }, [isNew]);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const dynamicStyles = StyleSheet.create({
    markerPin: {
      borderColor: theme.colors.white,
    },
  });

  return (
    <View style={styles.markerWrapper}>
      {isNew && (
        <Animated.View
          style={[styles.markerPulse, { backgroundColor: color }, pulseStyle]}
        />
      )}
      <View style={[styles.markerPin, dynamicStyles.markerPin, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={[styles.markerTriangle, { borderTopColor: color }]} />
    </View>
  );
};

export default function MapScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<any>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Data states
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation / user loc
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Bottom Sheet snap points
  const snapPoints = useMemo(() => ['42%'], []);

  // Category list configuration with dynamic theme colors for WCAG AA compliance
  const filters = useMemo(() => [
    { id: 'all', title: 'All Issues', icon: null, color: theme.colors.primary },
    { id: 'pothole', title: 'Potholes', icon: <Cone size={14} color={theme.colors.status.rejected} />, color: theme.colors.status.rejected },
    { id: 'garbage', title: 'Garbage', icon: <Trash2 size={14} color={theme.colors.status.pending} />, color: theme.colors.status.pending },
    { id: 'noise', title: 'Noise', icon: <Volume2 size={14} color={theme.colors.primary} />, color: theme.colors.primary },
    { id: 'accessibility', title: 'Accessibility', icon: <Accessibility size={14} color={theme.colors.status.approved} />, color: theme.colors.status.approved },
    { id: 'infrastructure', title: 'Infrastructure', icon: <Hammer size={14} color={theme.colors.status.flagged} />, color: theme.colors.status.flagged },
  ], [theme]);

  // Dynamic Styles
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.neutral[100],
    },
    errorContainer: {
      backgroundColor: theme.colors.neutral[100],
    },
    errorTitle: {
      color: theme.colors.neutral[900],
    },
    errorText: {
      color: theme.colors.neutral[600],
    },
    chipInactive: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
    chipTextInactive: {
      color: theme.colors.neutral[600],
    },
    fabLocation: {
      backgroundColor: theme.colors.white,
      borderColor: theme.colors.neutral[200],
    },
    bottomSheetBg: {
      backgroundColor: theme.colors.white,
    },
    bottomSheetIndicator: {
      backgroundColor: theme.colors.neutral[300],
    },
    detailTitle: {
      color: theme.colors.neutral[900],
    },
    detailTime: {
      color: theme.colors.neutral[500],
    },
    detailPhoto: {
      backgroundColor: theme.colors.neutral[200],
    },
    violationContainer: {
      backgroundColor: theme.colors.neutral[200],
    },
    violationText: {
      color: theme.colors.neutral[600],
    },
    notesLabel: {
      color: theme.colors.neutral[400],
    },
    detailNotes: {
      color: theme.colors.neutral[700],
    },
    coordinatesText: {
      color: theme.colors.neutral[500],
    },
  });

  const [region, setRegion] = useState<Region>(defaultRegion);
  const debounceTimerRef = useRef<any>(null);
  const isFirstLoadRef = useRef(true);
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState<boolean>(false);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [activeHazards, setActiveHazards] = useState<any[]>([]);
  const [hazardModalVisible, setHazardModalVisible] = useState(false);
  const [clusterEvents, setClusterEvents] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    getOrInitializeLiteMode().then(setIsLiteMode);
  }, []);

  // Fetch approved submissions inside bounds
  const loadSubmissionsInBounds = useCallback(async (targetRegion: Region, isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    setError(null);

    const minLat = targetRegion.latitude - targetRegion.latitudeDelta / 2;
    const maxLat = targetRegion.latitude + targetRegion.latitudeDelta / 2;
    const minLon = targetRegion.longitude - targetRegion.longitudeDelta / 2;
    const maxLon = targetRegion.longitude + targetRegion.longitudeDelta / 2;

    try {
      const data = await fetchApprovedSubmissionsInBounds({
        minLat,
        minLon,
        maxLat,
        maxLon,
        missionType: activeFilter !== 'all' ? activeFilter : undefined
      });
      setSubmissions(data);
    } catch (err: any) {
      console.error('Error loading submissions in bounds:', err);
      setError(err?.message || 'Failed to sync reports database.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Fetch user location
  const syncUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      return loc;
    } catch (err) {
      console.log('Unable to sync user location:', err);
    }
  };

  // Realtime & Presence subscriptions (Skipped in Lite Mode to save RAM/battery/data)
  useEffect(() => {
    if (isLiteMode) return;

    const unsubscribeMap = subscribeToMapChanges(
      () => loadSubmissionsInBounds(region, true),
      () => loadSubmissionsInBounds(region, true)
    );

    const wardKey = `ward_${Math.round(region.latitude * 100)}_${Math.round(region.longitude * 100)}`;
    const unsubscribePresence = subscribeToViewportPresence(wardKey, (count) => {
      setViewerCount(count);
    });

    return () => {
      unsubscribeMap();
      unsubscribePresence();
    };
  }, [isLiteMode, region, loadSubmissionsInBounds]);

  // Trigger load on active filter change if we have current region
  useEffect(() => {
    if (region) {
      loadSubmissionsInBounds(region, true);
    }
  }, [activeFilter, loadSubmissionsInBounds]);

  // Initialize user location and cleanup timer
  useEffect(() => {
    syncUserLocation();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      loadSubmissionsInBounds(newRegion, isFirstLoadRef.current ? false : true);
      isFirstLoadRef.current = false;
    }, 300);
  };

  // Jump Map to current location FAB action
  const jumpToUserLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const loc = await syncUserLocation();
    if (loc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Location sync failed',
        text2: 'Make sure GPS is enabled and permissions are granted.',
      });
    }
  };

  // On marker select
  const handleMarkerPress = (submission: Submission) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedSubmission(submission);
    bottomSheetRef.current?.expand();
  };

  // Get icon for marker based on type
  const getMarkerIcon = (type: string, color: string) => {
    switch (type) {
      case 'pothole':
        return <Cone size={14} color={color} accessibilityLabel="Pothole icon" />;
      case 'garbage':
        return <Trash2 size={14} color={color} accessibilityLabel="Garbage icon" />;
      case 'noise':
        return <Volume2 size={14} color={color} accessibilityLabel="Noise icon" />;
      case 'accessibility':
        return <Accessibility size={14} color={color} accessibilityLabel="Accessibility icon" />;
      case 'infrastructure':
        return <Hammer size={14} color={color} accessibilityLabel="Infrastructure icon" />;
      default:
        return <MapPin size={14} color={color} accessibilityLabel="Location pinpoint icon" />;
    }
  };

  // Filter submissions list client side
  const filteredSubmissions = useMemo(() => {
    if (activeFilter === 'all') return submissions;
    return submissions.filter((s) => s.mission_type === activeFilter);
  }, [submissions, activeFilter]);

  // Check if marker was created within last 24 hours to trigger pulse animation
  const isSubmissionNew = (dateString: string) => {
    const reportDate = new Date(dateString).getTime();
    const now = new Date().getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return now - reportDate < twentyFourHours;
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {loading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton height={60} style={styles.skeletonHeader} />
          <Skeleton height={height - 180} style={styles.skeletonMap} />
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, dynamicStyles.errorContainer]}>
          <AlertTriangle size={48} color={theme.colors.status.rejected} style={styles.errorIcon} accessibilityLabel="Alert icon" />
          <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>Database Sync Failed</Text>
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
          <Button
            title="Retry Connection"
            onPress={() => loadSubmissionsInBounds(region || defaultRegion)}
            variant="primary"
            style={styles.retryButton}
          />
        </View>
      ) : (
        <View style={styles.mapContainer}>
          {/* Map Clustering component */}
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={
              userLocation
                ? {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                  }
                : defaultRegion
            }
            clusterColor={theme.colors.primary}
            clusterTextColor={theme.colors.white}
            animationEnabled={true}
            radius={40}
            maxZoom={16}
            onRegionChangeComplete={handleRegionChangeComplete}
            accessibilityLabel="Interactive map showing civic issue submissions"
          >
            {filteredSubmissions.map((sub) => {
              const filterConfig = filters.find((f) => f.id === sub.mission_type);
              const color = filterConfig ? filterConfig.color : theme.colors.primary;
              const isNew = isSubmissionNew(sub.submitted_at || sub.captured_at);

              return (
                <Marker
                  key={sub.id}
                  coordinate={{ latitude: sub.latitude, longitude: sub.longitude }}
                  onPress={() => handleMarkerPress(sub)}
                  tracksViewChanges={false}
                >
                  <PulseMarker
                    color={color}
                    icon={getMarkerIcon(sub.mission_type, theme.colors.white)}
                    isNew={isNew}
                  />
                </Marker>
              );
            })}

            {/* Live Hazard Layer Markers */}
            {activeHazards.map((hz) => (
              <Marker
                key={hz.id}
                coordinate={{ latitude: hz.latitude, longitude: hz.longitude }}
                tracksViewChanges={false}
              >
                <View style={{ backgroundColor: '#DC2626', padding: 6, borderRadius: 16, borderBottomWidth: 2, borderBottomColor: '#991B1B' }}>
                  <AlertTriangle size={18} color="#FFFFFF" />
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Viewport Presence Counter Banner */}
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10 }}>
            <Eye size={14} color="#38BDF8" />
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>
              {viewerCount} viewing this ward right now
            </Text>
          </View>

          {/* Floating Filter chips */}
          <View style={styles.filterFloatingContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {filters.map((f) => {
                const isActive = activeFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveFilter(f.id);
                      bottomSheetRef.current?.close();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by category: ${f.title}`}
                    accessibilityState={{ selected: isActive }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={[
                      styles.chip,
                      isActive ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : dynamicStyles.chipInactive,
                    ]}
                  >
                    {f.icon && (
                      <View style={styles.chipIcon}>
                        {React.cloneElement(f.icon, {
                          color: isActive ? theme.colors.white : theme.colors.neutral[500],
                        })}
                      </View>
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        isActive ? styles.chipTextActive : dynamicStyles.chipTextInactive,
                      ]}
                    >
                      {f.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
 
          {/* Jump User Location FAB */}
          <Pressable
            onPress={jumpToUserLocation}
            style={({ pressed }) => [
              styles.fabLocation,
              dynamicStyles.fabLocation,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Locate size={20} color={theme.colors.neutral[800]} />
          </Pressable>

          {/* Emergency Hazard FAB Button */}
          <Pressable
            onPress={() => setHazardModalVisible(true)}
            style={{
              position: 'absolute',
              bottom: 155,
              right: 16,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#DC2626',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
            }}
          >
            <AlertTriangle size={22} color="#FFFFFF" />
          </Pressable>
 
          {/* Gorhom Bottom Sheet */}
          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            backgroundStyle={[styles.bottomSheetBg, dynamicStyles.bottomSheetBg]}
            handleIndicatorStyle={[styles.bottomSheetIndicator, dynamicStyles.bottomSheetIndicator]}
          >
            <BottomSheetView style={styles.bottomSheetContent}>
              {selectedSubmission && (
                <View style={styles.detailContainer}>
                  {/* Category Details */}
                  <View style={styles.detailHeader}>
                    <View style={styles.detailTitleRow}>
                      <View
                        style={[
                          styles.detailIconBadge,
                          {
                            backgroundColor:
                              filters.find((f) => f.id === selectedSubmission.mission_type)
                                ?.color + '20' || '#5b21b620',
                          },
                        ]}
                      >
                        {getMarkerIcon(
                          selectedSubmission.mission_type,
                          filters.find((f) => f.id === selectedSubmission.mission_type)?.color ||
                            theme.colors.primary
                        )}
                      </View>
                      <View>
                        <Text style={[styles.detailTitle, dynamicStyles.detailTitle]}>
                          {selectedSubmission.mission_type.charAt(0).toUpperCase() +
                            selectedSubmission.mission_type.slice(1)}
                        </Text>
                        <View style={styles.timeRow}>
                          <Clock size={12} color={theme.colors.neutral[400]} accessibilityLabel="Clock icon" />
                          <Text style={[styles.detailTime, dynamicStyles.detailTime]}>
                            {new Date(selectedSubmission.captured_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <StatusIndicator status={selectedSubmission.status} />
                  </View>
 
                  {/* Body Content */}
                  <View style={selectedSubmission.resolution_photo_url ? styles.detailBodyStacked : styles.detailBody}>
                    {selectedSubmission.resolution_photo_url ? (
                      <View style={styles.beforeAfterContainer}>
                        <View style={styles.photoWrapper}>
                          <Image
                            source={{ uri: selectedSubmission.photo_url }}
                            style={styles.detailPhotoBefore}
                            accessibilityLabel="Photo before resolution"
                          />
                          <View style={styles.photoLabelBadge}>
                            <Text style={styles.photoLabelText}>Before</Text>
                          </View>
                        </View>
                        <View style={styles.photoWrapper}>
                          <Image
                            source={{ uri: selectedSubmission.resolution_photo_url }}
                            style={styles.detailPhotoAfter}
                            accessibilityLabel="Photo after resolution"
                          />
                          <View style={[styles.photoLabelBadge, { backgroundColor: theme.colors.status.approved }]}>
                            <Text style={styles.photoLabelText}>After</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      selectedSubmission.flags && selectedSubmission.flags.includes('auto_rejected_content_policy') ? (
                        <View style={[styles.detailPhoto, styles.violationContainer, dynamicStyles.violationContainer]}>
                          <Text style={[styles.violationText, dynamicStyles.violationText]}>This submission violated content guidelines</Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: selectedSubmission.photo_url }}
                          style={[styles.detailPhoto, dynamicStyles.detailPhoto]}
                          accessibilityLabel="Civic issue photo review"
                        />
                      )
                    )}
                    <View style={selectedSubmission.resolution_photo_url ? styles.detailTextWrapperFull : styles.detailTextWrapper}>
                      <Text style={[styles.notesLabel, dynamicStyles.notesLabel]}>Notes</Text>
                      <Text style={[styles.detailNotes, dynamicStyles.detailNotes]}>
                        {selectedSubmission.notes || 'No description added by reporter.'}
                      </Text>
                      <View style={styles.coordinatesWrapper}>
                        <MapPin size={12} color={theme.colors.neutral[500]} accessibilityLabel="Pin icon" />
                        <Text style={[styles.coordinatesText, dynamicStyles.coordinatesText]}>
                          Lat {selectedSubmission.latitude.toFixed(5)}, Lon{' '}
                          {selectedSubmission.longitude.toFixed(5)}
                        </Text>
                      </View>

                      {/* Social Upvote & Subscribe Buttons */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <Pressable
                          onPress={async () => {
                            try {
                              await apiFetch(`/clusters/${selectedSubmission.cluster_id || selectedSubmission.id}/upvote`, {
                                method: 'POST',
                                body: JSON.stringify({ user_id: 'anonymous' }),
                              });
                              Toast.show({
                                type: 'success',
                                text1: 'Upvoted!',
                                text2: 'Recorded: Me too, still an issue.',
                              });
                            } catch (_) {}
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#EFF6FF' }}
                        >
                          <ThumbsUp size={14} color="#2563EB" />
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2563EB' }}>Me too, still an issue</Text>
                        </Pressable>

                        <Pressable
                          onPress={async () => {
                            setIsSubscribed(!isSubscribed);
                            Toast.show({
                              type: 'success',
                              text1: isSubscribed ? 'Unsubscribed' : 'Subscribed!',
                              text2: isSubscribed ? 'Notifications disabled' : 'You will receive status update push alerts.',
                            });
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: isSubscribed ? '#DCFCE7' : '#F1F5F9' }}
                        >
                          <Bell size={14} color={isSubscribed ? '#16A34A' : '#475569'} />
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSubscribed ? '#16A34A' : '#475569' }}>
                            {isSubscribed ? 'Subscribed' : 'Notify me'}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Staged Delivery Status Timeline */}
                      <StatusTimeline currentStatus={selectedSubmission.status} events={clusterEvents} />

                      {/* Peer Flagging Action */}
                      <Pressable
                        onPress={() => setFlagModalVisible(true)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 12,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: '#FEF2F2',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Flag size={14} color="#EF4444" />
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#EF4444' }}>
                          Report this submission
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </BottomSheetView>
          </BottomSheet>

          {/* Peer Flagging Reason Modal */}
          <Modal visible={flagModalVisible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Flag size={20} color="#EF4444" />
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>Report Submission</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  Select the reason for reporting this civic submission. False reports impact credibility.
                </Text>

                {[
                  { id: 'not_real', title: 'Not a real civic issue' },
                  { id: 'inappropriate', title: 'Inappropriate or explicit content' },
                  { id: 'duplicate', title: 'Duplicate submission' },
                  { id: 'targets_person_property', title: 'Targets a person or private property' },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={async () => {
                      if (!selectedSubmission) return;
                      try {
                        await flagSubmission(selectedSubmission.id, item.id as any);
                        setFlagModalVisible(false);
                        Toast.show({
                          type: 'success',
                          text1: 'Flag Reported',
                          text2: 'Thank you for helping keep our community platform safe.',
                        });
                      } catch (err: any) {
                        Toast.show({
                          type: 'error',
                          text1: 'Report Failed',
                          text2: err?.message || 'Could not submit flag.',
                        });
                      }
                    }}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E293B' }}>{item.title}</Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => setFlagModalVisible(false)}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#64748B', fontWeight: 'bold' }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* Emergency Hazard Report Modal */}
          <HazardReportModal
            visible={hazardModalVisible}
            userLocation={userLocation}
            onClose={() => setHazardModalVisible(false)}
            onReportSuccess={() => {
              apiFetch('/hazards').then((data) => setActiveHazards(data || [])).catch(() => {});
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonContainer: {
    flex: 1,
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
  },
  skeletonHeader: {
    marginTop: 20,
  },
  skeletonMap: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[32],
  },
  errorIcon: {
    marginBottom: baseTheme.spacing[16],
  },
  errorTitle: {
    fontSize: baseTheme.typography.fontSizes.lg,
    fontWeight: baseTheme.typography.fontWeights.bold,
    marginBottom: baseTheme.spacing[8],
  },
  errorText: {
    fontSize: baseTheme.typography.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: baseTheme.spacing[24],
  },
  retryButton: {
    width: '100%',
    maxWidth: 200,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  filterFloatingContainer: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterScroll: {
    paddingHorizontal: baseTheme.spacing[16],
    gap: baseTheme.spacing[8],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: baseTheme.spacing[12],
    paddingVertical: baseTheme.spacing[8],
    borderRadius: baseTheme.radius.round,
    borderWidth: 1,
    ...baseTheme.shadows.low,
  },
  chipIcon: {
    marginRight: baseTheme.spacing[4],
  },
  chipText: {
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.semibold,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  fabLocation: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...baseTheme.shadows.medium,
  },
  bottomSheetBg: {
    borderTopLeftRadius: baseTheme.radius.xl,
    borderTopRightRadius: baseTheme.radius.xl,
    ...baseTheme.shadows.high,
  },
  bottomSheetIndicator: {
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 20,
  },
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: baseTheme.spacing[16],
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.spacing[12],
  },
  detailIconBadge: {
    width: 40,
    height: 40,
    borderRadius: baseTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: baseTheme.typography.fontSizes.lg,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detailTime: {
    fontSize: baseTheme.typography.fontSizes.xs,
  },
  detailBody: {
    flexDirection: 'row',
    gap: baseTheme.spacing[16],
  },
  detailBodyStacked: {
    flexDirection: 'column',
    gap: baseTheme.spacing[16],
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    gap: baseTheme.spacing[12],
    justifyContent: 'space-between',
    width: '100%',
  },
  photoWrapper: {
    flex: 1,
    position: 'relative',
    height: 120,
    borderRadius: baseTheme.radius.md,
    overflow: 'hidden',
  },
  detailPhotoBefore: {
    width: '100%',
    height: '100%',
  },
  detailPhotoAfter: {
    width: '100%',
    height: '100%',
  },
  photoLabelBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: baseTheme.typography.fontWeights.bold,
  },
  detailTextWrapperFull: {
    width: '100%',
    gap: 4,
  },
  detailPhoto: {
    width: 110,
    height: 110,
    borderRadius: baseTheme.radius.md,
  },
  violationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.spacing[8],
  },
  violationText: {
    fontSize: 9,
    fontWeight: baseTheme.typography.fontWeights.bold,
    textAlign: 'center',
  },
  detailTextWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: baseTheme.typography.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailNotes: {
    fontSize: baseTheme.typography.fontSizes.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  coordinatesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  coordinatesText: {
    fontSize: baseTheme.typography.fontSizes.xs,
  },

  // Pulsing Map Marker Styles
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  markerPulse: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    zIndex: 1,
  },
  markerPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    ...baseTheme.shadows.low,
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
    zIndex: 2,
  },
});
