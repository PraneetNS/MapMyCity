import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  Pressable,
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
  Flag,
  Eye,
  Bell,
  ThumbsUp,
  X,
  Layers,
} from 'lucide-react-native';

import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { fetchApprovedSubmissionsInBounds, flagSubmission } from '../services/submissions';
import type { Submission } from '../types';
import { Skeleton, Button, StatusIndicator } from '../components';
import { StatusTimeline } from '../components/StatusTimeline';
import { HazardReportModal } from '../components/HazardReportModal';
import { PermissionPromptModal } from '../components/PermissionPromptModal';
import {
  checkPermissionStatus,
  requestNativePermission,
} from '../services/permissionManager';
import { subscribeToMapChanges, subscribeToViewportPresence } from '../services/realtime';
import { getOrInitializeLiteMode } from '../services/liteMode';
import { apiFetch } from '../config/apiClient';

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

  return (
    <View style={styles.markerWrapper}>
      {isNew && (
        <Animated.View
          style={[styles.markerPulse, { backgroundColor: color }, pulseStyle]}
        />
      )}
      <View style={[styles.markerPin, { borderColor: theme.colors.white, backgroundColor: color }]}>
        {icon}
      </View>
      <View style={[styles.markerTriangle, { borderTopColor: color }]} />
    </View>
  );
};

export default function MapScreen() {
  const { theme, isDark } = useTheme();
  const { isMasterDetail, insets, width } = useResponsive();
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

  // Permission Prompt State
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);

  // Bottom Sheet snap points for phone portrait
  const snapPoints = useMemo(() => ['42%'], []);

  // Category list configuration
  const filters = useMemo(() => [
    { id: 'all', title: 'All Issues', icon: null, color: theme.colors.primary },
    { id: 'pothole', title: 'Potholes', icon: <Cone size={14} color={theme.colors.status.rejected} />, color: theme.colors.status.rejected },
    { id: 'garbage', title: 'Garbage', icon: <Trash2 size={14} color={theme.colors.status.pending} />, color: theme.colors.status.pending },
    { id: 'noise', title: 'Noise', icon: <Volume2 size={14} color={theme.colors.primary} />, color: theme.colors.primary },
    { id: 'accessibility', title: 'Accessibility', icon: <Accessibility size={14} color={theme.colors.status.approved} />, color: theme.colors.status.approved },
    { id: 'infrastructure', title: 'Infrastructure', icon: <Hammer size={14} color={theme.colors.status.flagged} />, color: theme.colors.status.flagged },
  ], [theme]);

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
        missionType: activeFilter !== 'all' ? activeFilter : undefined,
      });
      setSubmissions(data);
    } catch (err: any) {
      console.error('Error loading submissions in bounds:', err);
      setError(err?.message || 'Failed to sync reports database.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Just-in-time user location sync
  const syncUserLocation = async (showPromptIfDenied = false) => {
    const status = await checkPermissionStatus('location_foreground');
    if (status === 'blocked') {
      setIsLocationBlocked(true);
      if (showPromptIfDenied) setPermissionModalVisible(true);
      return null;
    }
    if (status !== 'granted') {
      if (showPromptIfDenied) {
        setPermissionModalVisible(true);
      }
      return null;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      return loc;
    } catch (err) {
      console.log('Unable to sync user location:', err);
      return null;
    }
  };

  const handleGrantLocation = async () => {
    setPermissionModalVisible(false);
    const result = await requestNativePermission('location_foreground');
    if (result === 'granted') {
      const loc = await syncUserLocation();
      if (loc && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 1000);
      }
    } else if (result === 'blocked') {
      setIsLocationBlocked(true);
    }
  };

  // Realtime subscriptions
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

  useEffect(() => {
    if (region) {
      loadSubmissionsInBounds(region, true);
    }
  }, [activeFilter, loadSubmissionsInBounds]);

  useEffect(() => {
    syncUserLocation(false);
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

  const jumpToUserLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const loc = await syncUserLocation(true);
    if (loc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }
  };

  const handleMarkerPress = (submission: Submission) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedSubmission(submission);
    if (!isMasterDetail) {
      bottomSheetRef.current?.expand();
    }
  };

  const getMarkerIcon = (type: string, color: string) => {
    switch (type) {
      case 'pothole':
        return <Cone size={14} color={color} />;
      case 'garbage':
        return <Trash2 size={14} color={color} />;
      case 'noise':
        return <Volume2 size={14} color={color} />;
      case 'accessibility':
        return <Accessibility size={14} color={color} />;
      case 'infrastructure':
        return <Hammer size={14} color={color} />;
      default:
        return <MapPin size={14} color={color} />;
    }
  };

  const filteredSubmissions = useMemo(() => {
    if (activeFilter === 'all') return submissions;
    return submissions.filter((s) => s.mission_type === activeFilter);
  }, [submissions, activeFilter]);

  const isSubmissionNew = (dateString: string) => {
    const reportDate = new Date(dateString).getTime();
    const now = new Date().getTime();
    return now - reportDate < 24 * 60 * 60 * 1000;
  };

  // Render detail view (used in both Tablet Side Panel and Phone Bottom Sheet)
  const renderDetailContent = (sub: Submission) => (
    <ScrollView style={styles.detailScrollView} contentContainerStyle={styles.detailScrollContent}>
      {/* Category Header */}
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleRow}>
          <View
            style={[
              styles.detailIconBadge,
              {
                backgroundColor:
                  filters.find((f) => f.id === sub.mission_type)?.color + '20' || '#5b21b620',
              },
            ]}
          >
            {getMarkerIcon(
              sub.mission_type,
              filters.find((f) => f.id === sub.mission_type)?.color || theme.colors.primary
            )}
          </View>
          <View>
            <Text style={[styles.detailTitle, { color: theme.colors.neutral[900] }]}>
              {sub.mission_type.charAt(0).toUpperCase() + sub.mission_type.slice(1)}
            </Text>
            <View style={styles.timeRow}>
              <Clock size={12} color={theme.colors.neutral[400]} />
              <Text style={[styles.detailTime, { color: theme.colors.neutral[500] }]}>
                {new Date(sub.captured_at).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
        <StatusIndicator status={sub.status} />
      </View>

      {/* Before / After Photo Stack */}
      {sub.resolution_photo_url ? (
        <View style={styles.beforeAfterContainer}>
          <View style={styles.photoWrapper}>
            <Image source={{ uri: sub.photo_url }} style={styles.detailPhotoBefore} />
            <View style={styles.photoLabelBadge}>
              <Text style={styles.photoLabelText}>Before</Text>
            </View>
          </View>
          <View style={styles.photoWrapper}>
            <Image source={{ uri: sub.resolution_photo_url }} style={styles.detailPhotoAfter} />
            <View style={[styles.photoLabelBadge, { backgroundColor: theme.colors.status.approved }]}>
              <Text style={styles.photoLabelText}>After</Text>
            </View>
          </View>
        </View>
      ) : (
        <Image
          source={{ uri: sub.photo_url }}
          style={[styles.detailPhoto, { backgroundColor: theme.colors.neutral[200] }]}
        />
      )}

      {/* Notes & Location metadata */}
      <View style={styles.detailTextWrapper}>
        <Text style={[styles.notesLabel, { color: theme.colors.neutral[400] }]}>Notes</Text>
        <Text style={[styles.detailNotes, { color: theme.colors.neutral[700] }]}>
          {sub.notes || 'No description provided by reporter.'}
        </Text>
        <View style={styles.coordinatesWrapper}>
          <MapPin size={12} color={theme.colors.neutral[500]} />
          <Text style={[styles.coordinatesText, { color: theme.colors.neutral[500] }]}>
            Lat {sub.latitude.toFixed(5)}, Lon {sub.longitude.toFixed(5)}
          </Text>
        </View>

        {/* Upvote & Notifications Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={async () => {
              try {
                await apiFetch(`/clusters/${sub.cluster_id || sub.id}/upvote`, {
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
            style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]}
          >
            <ThumbsUp size={14} color="#2563EB" />
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2563EB' }}>
              Me too, still an issue
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setIsSubscribed(!isSubscribed);
              Toast.show({
                type: 'success',
                text1: isSubscribed ? 'Unsubscribed' : 'Subscribed!',
                text2: isSubscribed ? 'Notifications disabled' : 'You will receive status update push alerts.',
              });
            }}
            style={[styles.actionBtn, { backgroundColor: isSubscribed ? '#DCFCE7' : '#F1F5F9' }]}
          >
            <Bell size={14} color={isSubscribed ? '#16A34A' : '#475569'} />
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSubscribed ? '#16A34A' : '#475569' }}>
              {isSubscribed ? 'Subscribed' : 'Notify me'}
            </Text>
          </Pressable>
        </View>

        {/* Status Timeline Progress Stepper */}
        <StatusTimeline currentStatus={sub.status} events={clusterEvents} />

        {/* Flagging Action */}
        <Pressable
          onPress={() => setFlagModalVisible(true)}
          style={[styles.flagBtn, { backgroundColor: '#FEF2F2' }]}
        >
          <Flag size={14} color="#EF4444" />
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#EF4444' }}>
            Report this submission
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.neutral[100] }]}>
      {loading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton height={60} style={{ marginTop: insets.top }} />
          <Skeleton height={300} style={{ flex: 1 }} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={theme.colors.status.rejected} />
          <Text style={[styles.errorTitle, { color: theme.colors.neutral[900] }]}>
            Database Sync Failed
          </Text>
          <Text style={[styles.errorText, { color: theme.colors.neutral[600] }]}>{error}</Text>
          <Button
            title="Retry Connection"
            onPress={() => loadSubmissionsInBounds(region || defaultRegion)}
            variant="primary"
            style={{ width: 200, marginTop: 16 }}
          />
        </View>
      ) : (
        <View style={[styles.mainLayout, isMasterDetail && styles.masterDetailContainer]}>
          {/* Main Map Canvas Pane */}
          <View style={[styles.mapPane, isMasterDetail && { flex: 1 }]}>
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

              {activeHazards.map((hz) => (
                <Marker
                  key={hz.id}
                  coordinate={{ latitude: hz.latitude, longitude: hz.longitude }}
                  tracksViewChanges={false}
                >
                  <View style={styles.hazardMarker}>
                    <AlertTriangle size={18} color="#FFFFFF" />
                  </View>
                </Marker>
              ))}
            </MapView>

            {/* Viewport Presence Counter */}
            <View
              style={[
                styles.presenceBadge,
                { top: Math.max(insets.top + 8, 12), right: 12 },
              ]}
            >
              <Eye size={14} color="#38BDF8" />
              <Text style={styles.presenceText}>{viewerCount} viewing this ward</Text>
            </View>

            {/* Floating Filter Chips */}
            <View
              style={[
                styles.filterFloatingContainer,
                { top: Math.max(insets.top + 8, 12), left: 12, right: isMasterDetail ? 200 : 180 },
              ]}
            >
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
                        if (!isMasterDetail) bottomSheetRef.current?.close();
                      }}
                      style={[
                        styles.chip,
                        isActive
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : { backgroundColor: theme.colors.white, borderColor: theme.colors.neutral[200] },
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
                          { color: isActive ? theme.colors.white : theme.colors.neutral[600] },
                        ]}
                      >
                        {f.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Floating Action Buttons respecting safe areas */}
            <Pressable
              onPress={jumpToUserLocation}
              style={[
                styles.fabLocation,
                {
                  bottom: Math.max(insets.bottom + 90, 100),
                  backgroundColor: theme.colors.white,
                  borderColor: theme.colors.neutral[200],
                },
              ]}
            >
              <Locate size={20} color={theme.colors.neutral[800]} />
            </Pressable>

            <Pressable
              onPress={() => setHazardModalVisible(true)}
              style={[
                styles.fabHazard,
                { bottom: Math.max(insets.bottom + 155, 165) },
              ]}
            >
              <AlertTriangle size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Master-Detail Tablet Side Panel */}
          {isMasterDetail ? (
            <View
              style={[
                styles.tabletSidePanel,
                {
                  backgroundColor: theme.colors.white,
                  borderLeftColor: theme.colors.neutral[200],
                  paddingTop: Math.max(insets.top, 16),
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              <View style={styles.tabletPanelHeader}>
                <Layers size={18} color={theme.colors.primary} />
                <Text style={[styles.tabletPanelTitle, { color: theme.colors.neutral[900] }]}>
                  Issue Details
                </Text>
                {selectedSubmission && (
                  <Pressable
                    onPress={() => setSelectedSubmission(null)}
                    style={styles.panelCloseBtn}
                  >
                    <X size={16} color={theme.colors.neutral[500]} />
                  </Pressable>
                )}
              </View>

              {selectedSubmission ? (
                renderDetailContent(selectedSubmission)
              ) : (
                <View style={styles.tabletEmptyState}>
                  <MapPin size={40} color={theme.colors.neutral[300]} />
                  <Text style={[styles.tabletEmptyTitle, { color: theme.colors.neutral[700] }]}>
                    No Issue Selected
                  </Text>
                  <Text style={[styles.tabletEmptyDesc, { color: theme.colors.neutral[500] }]}>
                    Tap on any map marker or hazard pin to inspect verification status, photos, and live timeline.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* Phone Bottom Sheet */
            <BottomSheet
              ref={bottomSheetRef}
              index={-1}
              snapPoints={snapPoints}
              enablePanDownToClose={true}
              backgroundStyle={{ backgroundColor: theme.colors.white }}
              handleIndicatorStyle={{ backgroundColor: theme.colors.neutral[300] }}
            >
              <BottomSheetView style={styles.bottomSheetContent}>
                {selectedSubmission && renderDetailContent(selectedSubmission)}
              </BottomSheetView>
            </BottomSheet>
          )}

          {/* Just-in-Time Location Permission Pre-Prompt Modal */}
          <PermissionPromptModal
            visible={permissionModalVisible}
            permissionType="location_foreground"
            isBlocked={isLocationBlocked}
            onGrant={handleGrantLocation}
            onDenyOrFallback={() => {
              setPermissionModalVisible(false);
              Toast.show({
                type: 'info',
                text1: 'Manual Location Mode',
                text2: 'You can browse and explore any ward by panning the map.',
              });
            }}
            onClose={() => setPermissionModalVisible(false)}
          />

          {/* Flagging Modal */}
          <Modal visible={flagModalVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Flag size={20} color="#EF4444" />
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>
                    Report Submission
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  Select the reason for reporting this submission.
                </Text>

                {[
                  { id: 'not_real', title: 'Not a real civic issue' },
                  { id: 'inappropriate', title: 'Inappropriate or explicit content' },
                  { id: 'duplicate', title: 'Duplicate submission' },
                  { id: 'targets_person_property', title: 'Targets private individual or property' },
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
                    style={styles.flagOption}
                  >
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E293B' }}>
                      {item.title}
                    </Text>
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
  mainLayout: {
    flex: 1,
  },
  masterDetailContainer: {
    flexDirection: 'row',
  },
  mapPane: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  tabletSidePanel: {
    width: 380,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tabletPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabletPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  panelCloseBtn: {
    padding: 4,
  },
  tabletEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  tabletEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  tabletEmptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  skeletonContainer: {
    flex: 1,
    padding: baseTheme.spacing[16],
    gap: baseTheme.spacing[16],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  presenceBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  presenceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterFloatingContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  filterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chipIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fabLocation: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    borderWidth: 1,
  },
  fabHazard: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  hazardMarker: {
    backgroundColor: '#DC2626',
    padding: 6,
    borderRadius: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#991B1B',
  },
  bottomSheetContent: {
    flex: 1,
  },
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    gap: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detailTime: {
    fontSize: 11,
  },
  detailPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  photoWrapper: {
    flex: 1,
    position: 'relative',
  },
  detailPhotoBefore: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  detailPhotoAfter: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  photoLabelBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailTextWrapper: {
    gap: 6,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailNotes: {
    fontSize: 13,
    lineHeight: 18,
  },
  coordinatesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  coordinatesText: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
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
    gap: 16,
  },
  flagOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
