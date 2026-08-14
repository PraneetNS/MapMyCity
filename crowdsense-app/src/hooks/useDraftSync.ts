import { useState, useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { getPendingCount, syncDraftQueue } from '../services/localQueue';

export function useDraftSync() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;

    try {
      const netState = await Network.getNetworkStateAsync();
      if (!netState.isConnected || !netState.isInternetReachable) {
        await refreshPendingCount();
        return;
      }

      const count = await getPendingCount();
      if (count === 0) {
        setPendingCount(0);
        return;
      }

      setIsSyncing(true);
      setSyncProgress({ current: 0, total: count });

      await syncDraftQueue((current, total) => {
        setSyncProgress({ current, total });
      });

      await refreshPendingCount();
    } catch (err) {
      console.error('Sync queue error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    // Check pending count on initial mount
    refreshPendingCount();

    // Set up periodic sync check every 15 seconds
    const intervalId = setInterval(() => {
      triggerSync();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [refreshPendingCount, triggerSync]);

  return {
    pendingCount,
    isSyncing,
    syncProgress,
    triggerSync,
    refreshPendingCount,
  };
}
