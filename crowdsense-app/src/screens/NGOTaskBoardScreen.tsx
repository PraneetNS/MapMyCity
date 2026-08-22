import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * NGOTaskBoardScreen — Part 5: Volunteer / NGO Task Board (Future Backlog)
 *
 * PRECONDITION GATE: Returns a clear "not yet available" state when the
 * TASK_BOARD_ENABLED backend flag is false (API returns 503).
 * See FUTURE_BACKLOG.md Part 5 for the precondition.
 *
 * Flow:
 *  1. Volunteer browses open tasks posted by NGO partners
 *  2. Claims a task → goes to site → submits accessibility audit
 *  3. Completes task with submission_id → badge awarded
 *  4. Completed task feeds into accessibility_audits data flow
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const TASK_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  accessibility_audit: { icon: '♿', label: 'Accessibility Audit', color: '#6C63FF' },
  safety_audit:        { icon: '🔒', label: 'Safety Audit',        color: '#FF6B6B' },
  utility_check:       { icon: '⚡', label: 'Utility Check',        color: '#FFD166' },
  road_quality_spot:   { icon: '🛣️', label: 'Road Quality Spot',   color: '#06D6A0' },
};

const STATUS_COLOR: Record<string, string> = {
  open: '#06D6A0', claimed: '#FFD166', completed: '#6C63FF', cancelled: '#555',
};

interface AuditTask {
  id: string;
  partner_org_id: string;
  partner_name: string;
  location_hint: string;
  latitude?: number;
  longitude?: number;
  task_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface UserBadge {
  badge_type: string;
  awarded_at: string;
}

interface Props {
  userId?: string;
  onNavigateToCapture?: (params: Record<string, string>) => void;
  onBack: () => void;
}

export default function NGOTaskBoardScreen({ userId, onNavigateToCapture, onBack }: Props) {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preconditionGated, setPreconditionGated] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AuditTask | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('task_type', filterType);
      const res = await fetch(`${API_BASE}/audit-tasks?${params.toString()}`);
      if (res.status === 503) { setPreconditionGated(true); return; }
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      // keep existing list on network failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleClaim = async (task: AuditTask) => {
    if (!userId) { Alert.alert('Sign in required', 'Please sign in to claim tasks.'); return; }
    Alert.alert(
      'Claim this task?',
      `You'll head to "${task.location_hint}" to complete a ${TASK_TYPE_META[task.task_type]?.label ?? task.task_type}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim & go',
          onPress: async () => {
            setClaiming(task.id);
            try {
              const res = await fetch(`${API_BASE}/audit-tasks/${task.id}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
              });
              if (!res.ok) throw new Error('Already claimed');
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'claimed' } : t));
              setSelectedTask(null);
              // Navigate to the relevant capture form
              onNavigateToCapture?.({
                category: task.task_type === 'accessibility_audit' ? 'accessibility' : 'infrastructure',
                task_id: task.id,
              });
            } catch {
              Alert.alert('Could not claim', 'This task may have already been claimed. Pull to refresh.');
            } finally {
              setClaiming(null);
            }
          },
        },
      ],
    );
  };

  const handleComplete = async (task: AuditTask, submissionId?: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/audit-tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, resulting_submission_id: submissionId }),
      });
      const data = await res.json();
      setTasks(prev => prev.filter(t => t.id !== task.id));
      setSelectedTask(null);
      if (data.badge_awarded) {
        Alert.alert(
          '🏅 Badge Earned!',
          'You earned the NGO Task Completer badge. Check your profile to see all your badges.',
          [{ text: 'Nice!', style: 'default' }],
        );
      }
    } catch {
      Alert.alert('Error', 'Could not mark task complete. Try again.');
    }
  };

  const renderFilterChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      <TouchableOpacity
        style={[styles.chip, !filterType && styles.chipActive]}
        onPress={() => setFilterType(null)}
      >
        <Text style={[styles.chipText, !filterType && styles.chipTextActive]}>All</Text>
      </TouchableOpacity>
      {Object.entries(TASK_TYPE_META).map(([key, meta]) => (
        <TouchableOpacity
          key={key}
          style={[styles.chip, filterType === key && styles.chipActive, { borderColor: meta.color }]}
          onPress={() => setFilterType(filterType === key ? null : key)}
        >
          <Text style={styles.chipText}>{meta.icon} {meta.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTask = ({ item }: { item: AuditTask }) => {
    const meta = TASK_TYPE_META[item.task_type] ?? { icon: '📋', label: item.task_type, color: '#888' };
    return (
      <TouchableOpacity style={styles.taskCard} onPress={() => setSelectedTask(item)} activeOpacity={0.8}>
        <View style={[styles.taskTypeBar, { backgroundColor: meta.color }]} />
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskIcon}>{meta.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskType}>{meta.label}</Text>
              <Text style={styles.partnerName}>by {item.partner_name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '30', borderColor: STATUS_COLOR[item.status] }]}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.locationHint}>📍 {item.location_hint}</Text>
          {item.notes && <Text style={styles.taskNotes} numberOfLines={2}>{item.notes}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Task detail modal ────────────────────────────────────────────────────────
  const renderTaskModal = () => {
    if (!selectedTask) return null;
    const meta = TASK_TYPE_META[selectedTask.task_type] ?? { icon: '📋', label: selectedTask.task_type, color: '#888' };
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedTask(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalAccent, { backgroundColor: meta.color }]} />
            <Text style={styles.modalTitle}>{meta.icon}  {meta.label}</Text>
            <Text style={styles.modalOrg}>Posted by: {selectedTask.partner_name}</Text>
            <View style={styles.divider} />
            <Text style={styles.modalLabel}>Location</Text>
            <Text style={styles.modalValue}>📍 {selectedTask.location_hint}</Text>
            {selectedTask.notes && (
              <>
                <Text style={styles.modalLabel}>Partner instructions</Text>
                <Text style={styles.modalValue}>{selectedTask.notes}</Text>
              </>
            )}
            <View style={styles.modalActions}>
              {selectedTask.status === 'open' && (
                <TouchableOpacity
                  style={[styles.claimBtn, { backgroundColor: meta.color }]}
                  onPress={() => handleClaim(selectedTask)}
                  disabled={claiming === selectedTask.id}
                >
                  {claiming === selectedTask.id
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.claimBtnText}>Claim this task</Text>
                  }
                </TouchableOpacity>
              )}
              {selectedTask.status === 'claimed' && (
                <TouchableOpacity
                  style={[styles.claimBtn, { backgroundColor: '#06D6A0' }]}
                  onPress={() => handleComplete(selectedTask)}
                >
                  <Text style={styles.claimBtnText}>Mark complete ✓</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setSelectedTask(null)}>
                <Text style={styles.cancelModalText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Volunteer Task Board</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#6C63FF" /></View>
      ) : preconditionGated ? (
        <View style={styles.centered}>
          <Text style={styles.gatedIcon}>🤝</Text>
          <Text style={styles.gatedTitle}>Coming soon</Text>
          <Text style={styles.gatedBody}>
            The volunteer task board goes live once our first NGO partner is onboarded.
            Check back soon — or reach out to partner@mapmycity.in to get your organisation involved.
          </Text>
        </View>
      ) : (
        <>
          {renderFilterChips()}
          <FlatList
            data={tasks}
            keyExtractor={t => t.id}
            renderItem={renderTask}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} tintColor="#6C63FF" />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {tasks.length} open task{tasks.length !== 1 ? 's' : ''} from partner organisations
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No open tasks right now</Text>
                <Text style={styles.emptyBody}>
                  Partner organisations post tasks here. Check back later or switch the filter above.
                </Text>
              </View>
            }
          />
        </>
      )}
      {renderTaskModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E1E2E' },
  backText: { color: '#6C63FF', fontSize: 16 },
  title: { color: '#E8E8F0', fontSize: 17, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  filterRow: { paddingVertical: 12, maxHeight: 56 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#1A1A2E' },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText: { color: '#A0A0C8', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  listHeader: { color: '#666', fontSize: 12, marginBottom: 4 },
  taskCard: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#252540' },
  taskTypeBar: { width: 4 },
  taskContent: { flex: 1, padding: 14, gap: 6 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskIcon: { fontSize: 24 },
  taskType: { color: '#E8E8F0', fontSize: 14, fontWeight: '700' },
  partnerName: { color: '#666', fontSize: 11, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  locationHint: { color: '#9898C0', fontSize: 13 },
  taskNotes: { color: '#666', fontSize: 12, fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, overflow: 'hidden' },
  modalAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  modalTitle: { color: '#E8E8F0', fontSize: 20, fontWeight: '700', marginTop: 8 },
  modalOrg: { color: '#888', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#252540', marginVertical: 4 },
  modalLabel: { color: '#6C63FF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  modalValue: { color: '#C0C0E0', fontSize: 14, lineHeight: 21 },
  modalActions: { gap: 10, marginTop: 8 },
  claimBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  claimBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelModalBtn: { padding: 12, alignItems: 'center' },
  cancelModalText: { color: '#666', fontSize: 14 },

  // Empty / gated states
  emptyState: { alignItems: 'center', padding: 48, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#E8E8F0', fontSize: 18, fontWeight: '700' },
  emptyBody: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  gatedIcon: { fontSize: 64, marginBottom: 16 },
  gatedTitle: { color: '#E8E8F0', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  gatedBody: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
