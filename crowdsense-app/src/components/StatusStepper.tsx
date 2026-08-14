import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, Wrench, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export interface StepEvent {
  status: 'submitted' | 'acknowledged' | 'in_progress' | 'resolved';
  title: string;
  timestamp?: string;
  description?: string;
}

interface StatusStepperProps {
  currentStatus: string;
  events?: StepEvent[];
}

export function StatusStepper({ currentStatus, events }: StatusStepperProps) {
  const { theme } = useTheme();

  const steps: StepEvent[] = events || [
    {
      status: 'submitted',
      title: 'Report Submitted',
      description: 'Submitted by verified citizen',
    },
    {
      status: 'acknowledged',
      title: 'Tier-0 Verified & Clustered',
      description: 'Location & duplicate pHash check passed',
    },
    {
      status: 'in_progress',
      title: 'Dispatched to Municipal Ward',
      description: 'Assigned to Ward Maintenance Team',
    },
    {
      status: 'resolved',
      title: 'Issue Resolved & Fixed',
      description: 'Verified fixed on-ground',
    },
  ];

  const getStepState = (stepIndex: number): 'completed' | 'active' | 'upcoming' => {
    const statusLower = (currentStatus || 'pending').toLowerCase();
    if (statusLower === 'resolved' || statusLower === 'verified_fixed') {
      return 'completed';
    }
    if (statusLower === 'in_progress') {
      return stepIndex <= 2 ? (stepIndex === 2 ? 'active' : 'completed') : 'upcoming';
    }
    if (statusLower === 'approved' || statusLower === 'acknowledged') {
      return stepIndex <= 1 ? (stepIndex === 1 ? 'active' : 'completed') : 'upcoming';
    }
    return stepIndex === 0 ? 'active' : 'upcoming';
  };

  const getStepIcon = (status: string, state: 'completed' | 'active' | 'upcoming') => {
    if (state === 'completed') {
      return <CheckCircle2 size={18} color="#FFFFFF" />;
    }
    if (status === 'in_progress') {
      return <Wrench size={16} color={state === 'active' ? '#FFFFFF' : '#94A3B8'} />;
    }
    if (status === 'resolved') {
      return <ShieldCheck size={16} color={state === 'active' ? '#FFFFFF' : '#94A3B8'} />;
    }
    return <Clock size={16} color={state === 'active' ? '#FFFFFF' : '#94A3B8'} />;
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const state = getStepState(index);
        const isLast = index === steps.length - 1;

        let dotBg = theme.colors.neutral[300];
        let lineBg = theme.colors.neutral[300];
        if (state === 'completed') {
          dotBg = theme.colors.status.approved;
          lineBg = theme.colors.status.approved;
        } else if (state === 'active') {
          dotBg = theme.colors.primaryVibrant;
        }

        return (
          <View key={step.status} style={styles.stepRow}>
            {/* Left Column: Icon Dot & Connecting Line */}
            <View style={styles.leftCol}>
              <View style={[styles.dotCircle, { backgroundColor: dotBg }]}>
                {getStepIcon(step.status, state)}
              </View>
              {!isLast && <View style={[styles.connectingLine, { backgroundColor: lineBg }]} />}
            </View>

            {/* Right Column: Title, Timestamp, Description */}
            <View style={styles.rightCol}>
              <Text
                style={[
                  styles.title,
                  {
                    color: state === 'upcoming' ? theme.colors.neutral[500] : theme.colors.neutral[900],
                    fontWeight: state === 'active' ? 'bold' : '600',
                  },
                ]}
              >
                {step.title}
              </Text>

              {Boolean(step.description) && (
                <Text style={[styles.description, { color: theme.colors.neutral[600] }]}>
                  {step.description}
                </Text>
              )}

              {Boolean(step.timestamp) && (
                <Text style={[styles.timestamp, { color: theme.colors.neutral[400] }]}>
                  {step.timestamp}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leftCol: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  dotCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  connectingLine: {
    width: 2,
    height: 36,
    marginTop: 2,
  },
  rightCol: {
    flex: 1,
    paddingTop: 3,
  },
  title: {
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
});
