import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Pressable } from 'react-native';
import { AlertCircle, ArrowLeft, MapPin } from 'lucide-react-native';
import { apiFetch } from '../config/apiClient';
import { StatusTimeline } from '../components/StatusTimeline';
import { useTheme } from '../theme/ThemeContext';

interface ClusterDetailScreenProps {
  clusterId: string;
  onBack?: () => void;
}

export default function ClusterDetailScreen({ clusterId, onBack }: ClusterDetailScreenProps) {
  const { theme } = useTheme();
  const [cluster, setCluster] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadClusterData = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const eventsData = await apiFetch(`/clusters/${clusterId}/events`);
        setEvents(eventsData || []);
        // Fetch cluster detail
        setCluster({
          id: clusterId,
          status: eventsData?.length > 0 ? eventsData[eventsData.length - 1].status : 'active',
        });
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    if (clusterId) loadClusterData();
  }, [clusterId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading cluster audit trail...</Text>
      </View>
    );
  }

  if (notFound || !cluster) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color="#DC2626" />
        <Text style={styles.notFoundTitle}>Cluster Not Found</Text>
        <Text style={styles.notFoundSubtitle}>
          This report cluster may have been resolved, deleted, or merged by moderators.
        </Text>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Return to Map</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.topBackHeader}>
          <ArrowLeft size={20} color="#0F172A" />
          <Text style={styles.headerTitle}>Cluster #{clusterId.slice(0, 8)}</Text>
        </Pressable>
      )}

      <StatusTimeline currentStatus={cluster.status} events={events} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 12,
  },
  notFoundSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  topBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
});
