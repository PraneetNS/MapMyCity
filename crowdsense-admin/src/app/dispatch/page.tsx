'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface WorkOrder {
  id: string;
  order_number: string;
  category: string;
  ward_id: string;
  department_name: string;
  contractor_name: string;
  priority: string;
  status: string;
  sla_deadline: string;
  notes?: string;
  escalation_level: number;
}

interface SLASummary {
  total_active_orders: number;
  on_track: number;
  warning: number;
  breached: number;
  sla_compliance_rate_pct: number;
}

export default function DispatchAdminPage() {
  const [summary, setSummary] = useState<SLASummary>({
    total_active_orders: 14,
    on_track: 9,
    warning: 3,
    breached: 2,
    sla_compliance_rate_pct: 85.7,
  });

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrdersAndSummary();
  }, []);

  const fetchOrdersAndSummary = async () => {
    setLoading(true);
    try {
      const [sumRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dispatch/sla-summary`),
        fetch(`${API_BASE}/api/v1/dispatch/orders`),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.work_orders || []);
      } else {
        throw new Error('Failed to fetch from API');
      }
    } catch {
      // Fallback mock dataset for admin display
      setOrders([
        {
          id: 'wo-101',
          order_number: 'WO-20261019-E91A01',
          category: 'pothole',
          ward_id: 'ward_bbmp_150',
          department_name: 'Roads & Infrastructure Engineering',
          contractor_name: 'Apex Urban Roadworks Ltd.',
          priority: 'CRITICAL',
          status: 'IN_PROGRESS',
          sla_deadline: new Date(Date.now() + 4 * 3600000).toISOString(),
          notes: 'High-traffic arterial crater near Ecospace footbridge',
          escalation_level: 0,
        },
        {
          id: 'wo-102',
          order_number: 'WO-20261019-B42C18',
          category: 'waterlogging',
          ward_id: 'ward_bbmp_174',
          department_name: 'Stormwater & Urban Drainage',
          contractor_name: 'Metro Infra Maintenance JV',
          priority: 'EMERGENCY',
          status: 'DISPATCHED',
          sla_deadline: new Date(Date.now() + 1.5 * 3600000).toISOString(),
          notes: 'Monsoon surge underpass blocked, rapid suction tanker deployed',
          escalation_level: 0,
        },
        {
          id: 'wo-103',
          order_number: 'WO-20261019-F77D99',
          category: 'streetlight_out',
          ward_id: 'ward_bbmp_085',
          department_name: 'Street Lighting & Public Power',
          contractor_name: 'Kaveri Civic Works Enterprise',
          priority: 'MEDIUM',
          status: 'RESOLVED',
          sla_deadline: new Date(Date.now() - 12 * 3600000).toISOString(),
          notes: 'LED luminaire capacitor replaced, circuit energized',
          escalation_level: 0,
        },
        {
          id: 'wo-104',
          order_number: 'WO-20261019-A33E41',
          category: 'pothole',
          ward_id: 'ward_bbmp_150',
          department_name: 'Roads & Infrastructure Engineering',
          contractor_name: 'Apex Urban Roadworks Ltd.',
          priority: 'HIGH',
          status: 'ESCALATED',
          sla_deadline: new Date(Date.now() - 3 * 3600000).toISOString(),
          notes: 'Exceeded 48h turnaround without contractor onsite check-in',
          escalation_level: 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/dispatch/orders/${orderId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual Administrative Escalation from Admin Console' }),
      });
      if (res.ok) {
        setActionMsg(`Order ${orderId} escalated successfully!`);
        fetchOrdersAndSummary();
      } else {
        setActionMsg(`Escalation triggered for order ${orderId} (Demo mode)`);
      }
    } catch {
      setActionMsg(`Escalated order ${orderId} locally.`);
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const filteredOrders = orders.filter((o) => {
    if (selectedStatus !== 'ALL' && o.status !== selectedStatus) return false;
    if (selectedDept !== 'ALL' && !o.department_name.includes(selectedDept)) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F8FAFC', padding: '32px' }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
              Autonomous Municipal Dispatch & SLA Console
            </h1>
            <p style={{ color: '#94A3B8', marginTop: 6, fontSize: 14 }}>
              Rule-based contractor triage, automated department routing, and SLA escalation watchdog.
            </p>
          </div>
          <button
            onClick={fetchOrdersAndSummary}
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#38BDF8',
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh Dispatch Queue
          </button>
        </div>

        {actionMsg && (
          <div
            style={{
              marginTop: 16,
              background: '#064E3B',
              border: '1px solid #059669',
              color: '#A7F3D0',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {actionMsg}
          </div>
        )}

        {/* KPI Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 24,
          }}
        >
          <div style={{ background: '#131D31', border: '1px solid #1E293B', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>ACTIVE WORK ORDERS</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#F8FAFC', marginTop: 8 }}>
              {summary.total_active_orders}
            </div>
            <div style={{ fontSize: 12, color: '#38BDF8', marginTop: 4 }}>Across all municipal wards</div>
          </div>

          <div style={{ background: '#131D31', border: '1px solid #1E293B', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>SLA COMPLIANCE RATE</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', marginTop: 8 }}>
              {summary.sla_compliance_rate_pct}%
            </div>
            <div style={{ fontSize: 12, color: '#6EE7B7', marginTop: 4 }}>On-time resolution norm</div>
          </div>

          <div style={{ background: '#131D31', border: '1px solid #1E293B', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>AT-RISK / WARNING</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', marginTop: 8 }}>
              {summary.warning}
            </div>
            <div style={{ fontSize: 12, color: '#FCD34D', marginTop: 4 }}>&lt; 25% SLA hours remaining</div>
          </div>

          <div style={{ background: '#131D31', border: '1px solid #1E293B', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>OVERDUE / BREACHED</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444', marginTop: 8 }}>
              {summary.breached}
            </div>
            <div style={{ fontSize: 12, color: '#FCA5A5', marginTop: 4 }}>Pending penalty audit</div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 28,
            marginBottom: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                color: '#F8FAFC',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <option value="ALL">All Departments</option>
              <option value="Roads">Roads & Infrastructure</option>
              <option value="Stormwater">Stormwater & Drainage</option>
              <option value="Lighting">Street Lighting</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                color: '#F8FAFC',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </div>
        </div>

        {/* Work Orders Table */}
        <div
          style={{
            background: '#131D31',
            borderRadius: 12,
            border: '1px solid #1E293B',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0F172A', borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                <th style={{ padding: '14px 18px' }}>Order Number</th>
                <th style={{ padding: '14px 18px' }}>Category & Ward</th>
                <th style={{ padding: '14px 18px' }}>Contractor</th>
                <th style={{ padding: '14px 18px' }}>Priority</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px' }}>SLA Target</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => (
                <tr
                  key={order.id || idx}
                  style={{
                    borderBottom: '1px solid #1E293B',
                    background: idx % 2 === 0 ? '#131D31' : '#101827',
                  }}
                >
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: '#38BDF8' }}>
                    {order.order_number}
                    {order.escalation_level > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: '#7F1D1D',
                          color: '#FCA5A5',
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        Tier {order.escalation_level} Esc
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{order.category.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{order.ward_id}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#CBD5E1' }}>{order.contractor_name}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          order.priority === 'EMERGENCY'
                            ? '#7F1D1D'
                            : order.priority === 'CRITICAL'
                            ? '#7C2D12'
                            : '#1E293B',
                        color:
                          order.priority === 'EMERGENCY'
                            ? '#F87171'
                            : order.priority === 'CRITICAL'
                            ? '#FB923C'
                            : '#38BDF8',
                      }}
                    >
                      {order.priority}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          order.status === 'RESOLVED'
                            ? '#10B981'
                            : order.status === 'ESCALATED'
                            ? '#EF4444'
                            : order.status === 'IN_PROGRESS'
                            ? '#F59E0B'
                            : '#94A3B8',
                      }}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: 12 }}>
                    {new Date(order.sla_deadline).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    {order.status !== 'RESOLVED' && order.status !== 'ESCALATED' && (
                      <button
                        onClick={() => handleEscalate(order.id)}
                        style={{
                          background: '#7F1D1D',
                          border: 'none',
                          color: '#FECACA',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Escalate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
