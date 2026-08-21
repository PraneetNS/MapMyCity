import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  MapPin,
  Mic,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  ResourcePermissionType,
  PERMISSION_RATIONALES,
  openAppSettings,
} from '../services/permissionManager';
import { Button } from './Button';

export interface PermissionPromptModalProps {
  visible: boolean;
  permissionType: ResourcePermissionType;
  isBlocked?: boolean;
  onGrant: () => void;
  onDenyOrFallback: () => void;
  onClose: () => void;
}

export function PermissionPromptModal({
  visible,
  permissionType,
  isBlocked = false,
  onGrant,
  onDenyOrFallback,
  onClose,
}: PermissionPromptModalProps) {
  const { theme, isDark } = useTheme();
  const rationale = PERMISSION_RATIONALES[permissionType] || PERMISSION_RATIONALES.location_foreground;

  const renderIcon = () => {
    switch (permissionType) {
      case 'camera':
        return <Camera size={28} color={theme.colors.primary} />;
      case 'photo_library':
        return <ImageIcon size={28} color={theme.colors.primary} />;
      case 'location_foreground':
        return <MapPin size={28} color={theme.colors.primary} />;
      case 'microphone':
        return <Mic size={28} color={theme.colors.primary} />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.white,
              borderColor: theme.colors.neutral[200],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrapper, { backgroundColor: `${theme.colors.primary}15` }]}>
              {renderIcon()}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: theme.colors.neutral[100] }]}
            >
              <X size={18} color={theme.colors.neutral[600]} />
            </Pressable>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>
            {isBlocked ? `${rationale.title} (Disabled)` : rationale.title}
          </Text>
          <Text style={[styles.description, { color: theme.colors.neutral[600] }]}>
            {isBlocked
              ? `You previously denied access. To enable this feature, please allow ${permissionType.replace('_', ' ')} permission in your system settings.`
              : rationale.description}
          </Text>

          {/* Fallback assurance banner */}
          <View
            style={[
              styles.fallbackBanner,
              {
                backgroundColor: theme.colors.neutral[100],
                borderColor: theme.colors.neutral[200],
              },
            ]}
          >
            <ShieldCheck size={16} color={theme.colors.status.approved} />
            <Text style={[styles.fallbackText, { color: theme.colors.neutral[700] }]}>
              {rationale.fallbackDescription}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionContainer}>
            {isBlocked ? (
              <Button
                title="Open Settings"
                variant="primary"
                onPress={() => {
                  openAppSettings();
                  onClose();
                }}
                style={styles.primaryAction}
              />
            ) : (
              <Button
                title="Continue & Allow"
                variant="primary"
                onPress={onGrant}
                style={styles.primaryAction}
              />
            )}

            <Button
              title="Not Now (Use Fallback)"
              variant="secondary"
              onPress={onDenyOrFallback}
              style={styles.secondaryAction}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  fallbackText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  actionContainer: {
    gap: 10,
  },
  primaryAction: {
    width: '100%',
  },
  secondaryAction: {
    width: '100%',
  },
});
