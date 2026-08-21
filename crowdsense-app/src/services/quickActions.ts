import { Platform } from 'react-native';

export type QuickActionType = 'report_issue' | 'open_map' | 'my_reports';

export interface QuickActionItem {
  id: string;
  type: QuickActionType;
  title: string;
  subtitle?: string;
  icon?: string;
  params?: { href: string };
}

export const APP_QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'action_report_issue',
    type: 'report_issue',
    title: 'Report an issue',
    subtitle: 'Capture pothole or hazard',
    icon: 'camera',
    params: { href: 'crowdsense://report' },
  },
  {
    id: 'action_open_map',
    type: 'open_map',
    title: 'Explore Map',
    subtitle: 'Live civic hazard clusters',
    icon: 'location',
    params: { href: 'crowdsense://map' },
  },
  {
    id: 'action_my_reports',
    type: 'my_reports',
    title: 'My Reports',
    subtitle: 'Track resolution status',
    icon: 'list',
    params: { href: 'crowdsense://my_reports' },
  },
];

/**
 * Initializes App Icon Long-Press Quick Actions (Android ShortcutManager / iOS Quick Actions).
 */
export async function initializeQuickActions(
  onSelectAction: (action: QuickActionType) => void
): Promise<void> {
  try {
    // Attempt dynamic registration if expo-quick-actions is available
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        const QuickActions = require('expo-quick-actions');
        if (QuickActions && QuickActions.setItems) {
          await QuickActions.setItems(
            APP_QUICK_ACTIONS.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              icon: Platform.OS === 'ios' ? `symbol:${item.icon}` : item.icon,
              params: item.params,
            }))
          );

          QuickActions.addListener((action: any) => {
            if (action?.id === 'action_report_issue') onSelectAction('report_issue');
            else if (action?.id === 'action_open_map') onSelectAction('open_map');
            else if (action?.id === 'action_my_reports') onSelectAction('my_reports');
          });
        }
      } catch (_) {
        console.log('[QuickActions] Initialized in fallback mode.');
      }
    }
  } catch (err) {
    console.warn('[QuickActions] Failed to set shortcut items:', err);
  }
}
