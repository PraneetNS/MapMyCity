import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'anon_key_string';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
  },
});

/**
 * Subscribes to real-time Postgres changes for submissions and clusters tables.
 */
export function subscribeToMapChanges(
  onSubmissionChange: (payload: any) => void,
  onClusterChange: (payload: any) => void
) {
  const channel = supabase
    .channel('map-live-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'submissions' },
      (payload) => onSubmissionChange(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clusters' },
      (payload) => onClusterChange(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Connects to a viewport presence channel for the visible map area
 * and tracks active viewer counts ("X people viewing this ward right now").
 */
export function subscribeToViewportPresence(
  wardOrGeohashKey: string,
  onPresenceUpdate: (viewerCount: number) => void
) {
  const presenceChannel = supabase.channel(`presence_${wardOrGeohashKey}`, {
    config: {
      presence: {
        key: `viewer_${Math.random().toString(36).substring(2, 7)}`,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const count = Object.keys(state).length || 1;
      onPresenceUpdate(count);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });

  return () => {
    supabase.removeChannel(presenceChannel);
  };
}
