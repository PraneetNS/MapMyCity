import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  ArrowLeft,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Camera,
  ShieldAlert,
} from 'lucide-react-native';
import {
  fetchAssignedWorkOrders,
  updateWorkOrderStatus,
  flushOfflineWorkOrderUpdates,
  WorkOrderItem,
} from '../services/workOrderSync';

interface WorkOrdersScreenProps {
  wardId?: string;
  onBack: () => void;
}

export default function WorkOrdersScreen({
  wardId = 'ward_bbmp_150',
  onBack,
}: WorkOrdersScreenProps) {
  const [orders, setOrders] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [workNotes, setWorkNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadOrders = async () => {
    try {
      const res = await fetchAssignedWorkOrders(wardId);
      setIsOffline(res.offline);
      setOrders(res.orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [wardId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await flushOfflineWorkOrderUpdates();
    await loadOrders();
  };

  const handleStartWork = async (orderId: string) => {
    setActionLoading(true);
    const res = await updateWorkOrderStatus(orderId, 'IN_PROGRESS', 'FIELD_OPERATOR_01');
    setActionLoading(false);
    if (res.success) {
      Toast.show({
        type: 'success',
        text1: 'Work Started',
        text2: res.offline ? 'Status queued locally (offline)' : 'Status updated to In-Progress',
      });
      loadOrders();
    }
  };

  const handleCompleteWork = async (orderId: string) => {
    if (!proofUrl.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Proof Required',
        text2: 'Please enter resolution proof URL or image tag.',
      });
      return;
    }

    setActionLoading(true);
    const res = await updateWorkOrderStatus(
      orderId,
      'RESOLVED',
      'FIELD_OPERATOR_01',
      proofUrl,
      workNotes
    );
    setActionLoading(false);

    if (res.success) {
      Toast.show({
        type: 'success',
        text1: 'Work Order Resolved',
        text2: res.offline ? 'Resolution queued for sync' : 'Contractor resolution recorded!',
      });
      setResolvingId(null);
      setProofUrl('');
      setWorkNotes('');
      loadOrders();
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'EMERGENCY':
        return '#EF4444';
      case 'CRITICAL':
        return '#F97316';
      case 'HIGH':
        return '#FBBF24';
      default:
        return '#38BDF8';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Municipal Work Orders</Text>
          <Text style={styles.headerSubtitle}>Field Dispatch & Repair Queue</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <RefreshCw size={20} color="#38BDF8" />
        </Pressable>
      </View>

      {/* Offline Alert Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <AlertTriangle size={16} color="#F59E0B" />
          <Text style={styles.offlineText}>
            Offline Mode: Status updates are saved locally and synced on reconnect.
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED'].map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setFilter(tab)}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Fetching assigned work orders...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={48} color="#10B981" />
              <Text style={styles.emptyTitle}>All Clear in {wardId}</Text>
              <Text style={styles.emptyDesc}>No pending work orders matching this filter.</Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const pColor = getPriorityColor(order.priority);
              const isResolving = resolvingId === order.id;

              return (
                <View key={order.id} style={styles.orderCard}>
                  {/* Top Bar of Card */}
                  <View style={styles.cardHeader}>
                    <View style={styles.orderNumWrap}>
                      <Wrench size={16} color="#38BDF8" />
                      <Text style={styles.orderNum}>{order.orderNumber}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { borderColor: pColor }]}>
                      <Text style={[styles.priorityText, { color: pColor }]}>{order.priority}</Text>
                    </View>
                  </View>

                  {/* Details */}
                  <Text style={styles.cardCategory}>{order.category.toUpperCase()}</Text>
                  <Text style={styles.deptText}>{order.departmentName}</Text>

                  <View style={styles.metaRow}>
                    <MapPin size={14} color="#94A3B8" />
                    <Text style={styles.metaText}>{order.wardId}</Text>
                    <Clock size={14} color="#94A3B8" style={{ marginLeft: 12 }} />
                    <Text style={styles.metaText}>
                      Deadline: {new Date(order.slaDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {order.notes && <Text style={styles.notesText}>{order.notes}</Text>}

                  {/* Status Indicator */}
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.statusValue,
                        order.status === 'RESOLVED' && { color: '#10B981' },
                        order.status === 'IN_PROGRESS' && { color: '#FBBF24' },
                      ]}
                    >
                      {order.status}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  {order.status === 'DISPATCHED' && (
                    <Pressable
                      onPress={() => handleStartWork(order.id)}
                      disabled={actionLoading}
                      style={styles.actionBtnPrimary}
                    >
                      <Wrench size={16} color="#0F172A" />
                      <Text style={styles.actionBtnPrimaryText}>Accept & Begin Repair</Text>
                    </Pressable>
                  )}

                  {order.status === 'IN_PROGRESS' && !isResolving && (
                    <Pressable
                      onPress={() => setResolvingId(order.id)}
                      style={styles.actionBtnSuccess}
                    >
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.actionBtnSuccessText}>Complete & Submit Proof</Text>
                    </Pressable>
                  )}

                  {/* Resolving Form Accordion */}
                  {isResolving && (
                    <View style={styles.resolutionForm}>
                      <Text style={styles.formTitle}>Resolution Verification</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Resolution proof photo URL / storage URI"
                        placeholderTextColor="#64748B"
                        value={proofUrl}
                        onChangeText={setProofUrl}
                      />
                      <TextInput
                        style={[styles.input, { height: 60 }]}
                        placeholder="Materials used & repair notes..."
                        placeholderTextColor="#64748B"
                        multiline
                        value={workNotes}
                        onChangeText={setWorkNotes}
                      />
                      <View style={styles.resolveBtnGroup}>
                        <Pressable
                          onPress={() => setResolvingId(null)}
                          style={styles.cancelBtn}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleCompleteWork(order.id)}
                          disabled={actionLoading}
                          style={styles.submitBtn}
                        >
                          {actionLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.submitBtnText}>Confirm Resolution</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  refreshButton: {
    padding: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451A03',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#78350F',
  },
  offlineText: {
    color: '#FDE68A',
    fontSize: 12,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  filterChipActive: {
    backgroundColor: '#38BDF8',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0F172A',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  orderCard: {
    backgroundColor: '#131D31',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 8,
  },
  deptText: {
    fontSize: 13,
    color: '#38BDF8',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  actionBtnPrimaryText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  actionBtnSuccessText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resolutionForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 8,
  },
  resolveBtnGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
