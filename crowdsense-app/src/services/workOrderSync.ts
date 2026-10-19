import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export interface WorkOrderItem {
  id: string;
  orderNumber: string;
  clusterId: string;
  category: string;
  wardId: string;
  departmentName: string;
  contractorName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
  status: 'PENDING' | 'DISPATCHED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'REJECTED';
  slaDeadline: string;
  notes?: string;
  resolutionProofUrl?: string;
  materialsCost?: number;
}

export interface OfflineWorkOrderUpdate {
  orderId: string;
  status: WorkOrderItem['status'];
  actorId: string;
  resolutionProofUrl?: string;
  notes?: string;
  timestamp: string;
}

const OFFLINE_WORK_ORDER_QUEUE_KEY = '@crowdsense_offline_work_orders';
const CACHED_WORK_ORDERS_KEY = '@crowdsense_cached_work_orders';

export async function fetchAssignedWorkOrders(wardId?: string): Promise<{
  orders: WorkOrderItem[];
  offline: boolean;
}> {
  try {
    const url = wardId
      ? `${API_BASE_URL}/api/v1/dispatch/orders?ward_id=${encodeURIComponent(wardId)}`
      : `${API_BASE_URL}/api/v1/dispatch/orders`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const rawOrders = data.work_orders || [];
      const formatted: WorkOrderItem[] = rawOrders.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        clusterId: o.cluster_id,
        category: o.category,
        wardId: o.ward_id,
        departmentName: o.department_name,
        contractorName: o.contractor_name,
        priority: o.priority,
        status: o.status,
        slaDeadline: o.sla_deadline,
        notes: o.notes,
        resolutionProofUrl: o.resolution_proof_url,
        materialsCost: o.materials_cost,
      }));

      // Cache locally for offline inspection
      await AsyncStorage.setItem(CACHED_WORK_ORDERS_KEY, JSON.stringify(formatted));
      return { orders: formatted, offline: false };
    }
  } catch (err) {
    console.warn('Network unavailable, falling back to cached work orders:', err);
  }

  // Fallback to cached items
  try {
    const cached = await AsyncStorage.getItem(CACHED_WORK_ORDERS_KEY);
    if (cached) {
      return { orders: JSON.parse(cached), offline: true };
    }
  } catch (cacheErr) {
    console.error('Failed reading cached work orders:', cacheErr);
  }

  return { orders: [], offline: true };
}

export async function updateWorkOrderStatus(
  orderId: string,
  newStatus: WorkOrderItem['status'],
  actorId: string,
  proofUrl?: string,
  notes?: string
): Promise<{ success: boolean; offline: boolean }> {
  const payload = {
    status: newStatus,
    actor_id: actorId,
    resolution_proof_url: proofUrl,
    notes,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/dispatch/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true, offline: false };
    }
  } catch (err) {
    console.warn('Network unavailable, queuing work order update offline:', err);
  }

  // Queue locally
  try {
    const rawQueue = await AsyncStorage.getItem(OFFLINE_WORK_ORDER_QUEUE_KEY);
    const queue: OfflineWorkOrderUpdate[] = rawQueue ? JSON.parse(rawQueue) : [];
    queue.push({
      orderId,
      status: newStatus,
      actorId,
      resolutionProofUrl: proofUrl,
      notes,
      timestamp: new Date().toISOString(),
    });
    await AsyncStorage.setItem(OFFLINE_WORK_ORDER_QUEUE_KEY, JSON.stringify(queue));
    return { success: true, offline: true };
  } catch (e) {
    console.error('Failed to save offline work order update:', e);
    return { success: false, offline: true };
  }
}

export async function flushOfflineWorkOrderUpdates(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_WORK_ORDER_QUEUE_KEY);
    if (!raw) return 0;

    const queue: OfflineWorkOrderUpdate[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const remaining: OfflineWorkOrderUpdate[] = [];
    let synced = 0;

    for (const update of queue) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/dispatch/orders/${update.orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: update.status,
            actor_id: update.actorId,
            resolution_proof_url: update.resolutionProofUrl,
            notes: update.notes,
          }),
        });

        if (res.ok) {
          synced++;
        } else {
          remaining.push(update);
        }
      } catch (networkErr) {
        remaining.push(update);
      }
    }

    await AsyncStorage.setItem(OFFLINE_WORK_ORDER_QUEUE_KEY, JSON.stringify(remaining));
    return synced;
  } catch (err) {
    console.error('Error during offline work order flush:', err);
    return 0;
  }
}
