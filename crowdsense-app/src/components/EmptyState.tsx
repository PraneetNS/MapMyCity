import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Inbox, MapPin, AlertCircle, Sparkles } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: 'inbox' | 'map' | 'alert' | 'sparkles' | React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'inbox',
  title,
  subtitle,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    const size = 36;
    const color = theme.colors.primaryVibrant;
    switch (icon) {
      case 'map':
        return <MapPin size={size} color={color} />;
      case 'alert':
        return <AlertCircle size={size} color={color} />;
      case 'sparkles':
        return <Sparkles size={size} color={color} />;
      default:
        return <Inbox size={size} color={color} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryBg }]}>
        {renderIcon()}
      </View>
      <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.neutral[600] }]}>
        {subtitle || description}
      </Text>
      {Boolean(actionLabel && onAction) && (
        <Button
          title={actionLabel!}
          onPress={onAction!}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    marginTop: 8,
    minWidth: 160,
  },
});
