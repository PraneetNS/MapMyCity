import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Zap, Layers } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export type StatusVariant =
  | 'pending'
  | 'approved'
  | 'resolved'
  | 'rejected'
  | 'flagged'
  | 'safety'
  | 'utility';

interface StatusBadgeProps {
  status: string | StatusVariant;
  label?: string;
  size?: 'small' | 'medium';
}

export function StatusBadge({ status, label, size = 'medium' }: StatusBadgeProps) {
  const { theme } = useTheme();

  const normalized = (status || 'pending').toLowerCase();

  let bg = theme.colors.status.pendingBg;
  let border = theme.colors.status.pendingBorder;
  let text = theme.colors.status.pending;
  let icon = <Clock size={size === 'small' ? 12 : 14} color={text} />;
  let displayText = label || 'Pending Review';

  if (normalized === 'approved' || normalized === 'acknowledged' || normalized === 'in_progress') {
    bg = theme.colors.status.approvedBg;
    border = theme.colors.status.approvedBorder;
    text = theme.colors.status.approved;
    icon = <CheckCircle2 size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || (normalized === 'in_progress' ? 'In Progress' : 'Verified & Approved');
  } else if (normalized === 'resolved' || normalized === 'resolved_pending_verification' || normalized === 'verified_fixed') {
    bg = theme.colors.status.approvedBg;
    border = theme.colors.status.approvedBorder;
    text = theme.colors.status.approved;
    icon = <CheckCircle2 size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || 'Resolved / Fixed';
  } else if (normalized === 'rejected' || normalized === 'auto_rejected') {
    bg = theme.colors.status.rejectedBg;
    border = theme.colors.status.rejectedBorder;
    text = theme.colors.status.rejected;
    icon = <XCircle size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || 'Rejected';
  } else if (normalized === 'flagged' || normalized === 'peer_flagged') {
    bg = theme.colors.status.flaggedBg;
    border = theme.colors.status.flaggedBorder;
    text = theme.colors.status.flagged;
    icon = <AlertTriangle size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || 'Community Flagged';
  } else if (normalized === 'safety' || normalized === 'safety_concern') {
    bg = theme.colors.status.safetyBg;
    border = theme.colors.status.safetyBorder;
    text = theme.colors.status.safety;
    icon = <ShieldAlert size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || 'Women’s Safety';
  } else if (normalized === 'utility' || normalized === 'utility_outage') {
    bg = theme.colors.status.utilityBg;
    border = theme.colors.status.utilityBorder;
    text = theme.colors.status.utility;
    icon = <Zap size={size === 'small' ? 12 : 14} color={text} />;
    displayText = label || 'Utility Outage';
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingHorizontal: size === 'small' ? 8 : 10,
          paddingVertical: size === 'small' ? 3 : 5,
        },
      ]}
    >
      {icon}
      <Text
        style={[
          styles.badgeText,
          {
            color: text,
            fontSize: size === 'small' ? 11 : 12,
          },
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '600',
  },
});
