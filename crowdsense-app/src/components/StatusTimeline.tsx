import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, Wrench, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export interface StatusEvent {
  status: string;
  changed_at: string;
  changed_by_role: 'citizen' | 'moderator' | 'municipal_partner';
}

interface StatusTimelineProps {
  currentStatus: string;
  events?: StatusEvent[];
}

const STAGES = [
  { id: 'active', label: 'Reported', icon: AlertCircle },
  { id: 'acknowledged', label: 'Acknowledged', icon: Clock },
  { id: 'in_progress', label: 'In Progress', icon: Wrench },
  { id: 'resolved_pending_verification', label: 'Resolved', icon: CheckCircle2 },
  { id: 'verified_fixed', label: 'Verified Fixed', icon: ShieldCheck },
];

export function StatusTimeline({ currentStatus, events = [] }: StatusTimelineProps) {
  const { theme } = useTheme();

  const getStageIndex = (status: string) => {
    if (status === 'resolved' || status === 'verified_fixed') return 4;
    if (status === 'resolved_pending_verification') return 3;
    if (status === 'in_progress') return 2;
    if (status === 'acknowledged') return 1;
    return 0;
  };

  const currentIndex = getStageIndex(currentStatus);

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.colors.neutral[900] }]}>
        Live Resolution Timeline
      </Text>

      <View style={styles.timelineRow}>
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <View key={stage.id} style={styles.stageItem}>
              <View
                style={[
                  styles.iconCircle,
                  isDone && { backgroundColor: theme.colors.primary },
                  isCurrent && styles.currentCircle,
                  !isDone && { backgroundColor: theme.colors.neutral[300] },
                ]}
              >
                <Icon size={14} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.stageLabel,
                  isDone ? { color: theme.colors.neutral[900], fontWeight: 'bold' } : { color: theme.colors.neutral[500] },
                ]}
              >
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Public Audit Trail Log */}
      {events.length > 0 && (
        <View style={styles.auditSection}>
          <Text style={[styles.auditHeading, { color: theme.colors.neutral[700] }]}>
            Public Audit Log
          </Text>
          {events.map((evt, index) => (
            <View key={index} style={styles.auditRow}>
              <Text style={styles.auditRole}>[{evt.changed_by_role.replace('_', ' ').toUpperCase()}]</Text>
              <Text style={styles.auditText}>
                Status updated to <Text style={{ fontWeight: 'bold' }}>{evt.status}</Text>
              </Text>
              <Text style={styles.auditDate}>
                {new Date(evt.changed_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  currentCircle: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  stageLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  auditSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  auditHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auditRole: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  auditText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  auditDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
