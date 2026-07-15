import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { theme as baseTheme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

type StatusType =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved_pending_verification'
  | 'verified_fixed'
  | 'reopened';

interface StatusIndicatorProps {
  status: StatusType;
  style?: ViewStyle;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  style,
}) => {
  const { theme } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          icon: <CheckCircle2 size={16} color={theme.colors.status.approved} accessibilityLabel="Approved status icon" />,
          bg: theme.colors.status.approvedBg,
          text: theme.colors.status.approved,
          border: theme.colors.status.approvedBorder,
          label: 'Approved',
        };
      case 'verified_fixed':
        return {
          icon: <CheckCircle2 size={16} color={theme.colors.status.approved} accessibilityLabel="Verified fixed status icon" />,
          bg: theme.colors.status.approvedBg,
          text: theme.colors.status.approved,
          border: theme.colors.status.approvedBorder,
          label: 'Verified Fixed',
        };
      case 'rejected':
        return {
          icon: <AlertCircle size={16} color={theme.colors.status.rejected} accessibilityLabel="Rejected status icon" />,
          bg: theme.colors.status.rejectedBg,
          text: theme.colors.status.rejected,
          border: theme.colors.status.rejectedBorder,
          label: 'Rejected',
        };
      case 'reopened':
        return {
          icon: <AlertCircle size={16} color={theme.colors.status.rejected} accessibilityLabel="Reopened status icon" />,
          bg: theme.colors.status.rejectedBg,
          text: theme.colors.status.rejected,
          border: theme.colors.status.rejectedBorder,
          label: 'Reopened',
        };
      case 'flagged':
        return {
          icon: <AlertCircle size={16} color={theme.colors.status.flagged} accessibilityLabel="Flagged status icon" />,
          bg: theme.colors.status.flaggedBg,
          text: theme.colors.status.flagged,
          border: theme.colors.status.flaggedBorder,
          label: 'Flagged',
        };
      case 'in_progress':
        return {
          icon: <Clock size={16} color={theme.colors.status.flagged} accessibilityLabel="In progress status icon" />,
          bg: theme.colors.status.flaggedBg,
          text: theme.colors.status.flagged,
          border: theme.colors.status.flaggedBorder,
          label: 'In Progress',
        };
      case 'acknowledged':
        return {
          icon: <Clock size={16} color={theme.colors.status.pending} accessibilityLabel="Acknowledged status icon" />,
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pending,
          border: theme.colors.status.pendingBorder,
          label: 'Acknowledged',
        };
      case 'resolved_pending_verification':
        return {
          icon: <Clock size={16} color={theme.colors.status.pending} accessibilityLabel="Resolved pending verification status icon" />,
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pending,
          border: theme.colors.status.pendingBorder,
          label: 'Resolved (Pending Verification)',
        };
      case 'pending':
      default:
        return {
          icon: <Clock size={16} color={theme.colors.status.pending} accessibilityLabel="Pending status icon" />,
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pending,
          border: theme.colors.status.pendingBorder,
          label: 'Pending',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      {config.icon}
      <Text style={[styles.text, { color: config.text }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: baseTheme.spacing[12],
    paddingVertical: baseTheme.spacing[4],
    borderRadius: baseTheme.radius.round,
    borderWidth: 1,
    gap: baseTheme.spacing[8],
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: baseTheme.typography.fontSizes.sm,
    fontWeight: baseTheme.typography.fontWeights.semibold,
    textTransform: 'capitalize',
  },
});
