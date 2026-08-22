'use client';
/**
 * Public Municipal SLA Dashboard — Part 4 (Future Backlog)
 *
 * PRECONDITION GATE: Only renders ward cards where `is_active = true` in
 * `partner_organisations`. If no partners are active, renders an honest
 * "no partner data" state rather than placeholder stats.
 *
 * See FUTURE_BACKLOG.md Part 4: at least one signed MoU + 90 days of
 * resolution_events data required before enabling this page.
 *
 * This page is intentionally public (no login) and shareable — it is meant
 * to be linked externally as an accountability asset.
 */

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface WardSLA {
  ward_id: string;
  ward_name: string;
  city: string;
  partner_name: string;
  total_resolved: number;
  sla_met_count: number;
  sla_met_pct: number;
  avg_resolution_hours: number;
  active_issues: number;
  quarter: string;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  avg_hours: number;
}

async function fetchSLAData(): Promise<{ wards: WardSLA[]; no_partners: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/sla-dashboard`, { cache: 'no-store' });
    if (!res.ok) return { wards: [], no_partners: true };
    return await res.json();
  } catch {
    return { wards: [], no_partners: true };
  }
}

function SLAGauge({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#06D6A0' : pct >= 60 ? '#FFD166' : '#FF6B6B';
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={96} height={96} viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="#1E1E2E" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        <text x="18" y="20.5" textAnchor="middle" fontSize="7" fill={color} fontWeight="700">
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: '#888', marginTop: 4 }}>SLA met</span>
    </div>
  );
}

export default function PublicSLAPage() {
  const [data, setData] = useState<{ wards: WardSLA[]; no_partners: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSLAData().then(d => { setData(d); setLoading(false); });
  }, []);

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>🗺️ MapMyCity</span>
          <div>
            <h1 style={styles.pageTitle}>Municipal SLA Dashboard</h1>
            <p style={styles.pageSubtitle}>
              Resolution performance for wards with active civic partnerships · Updated daily
            </p>
          </div>
          <a href="/benchmarks" style={styles.benchmarkLink}>View city benchmarks →</a>
        </div>
      </div>

      <div style={styles.content}>
        {/* ── Precondition / loading states ── */}
        {loading && (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p style={{ color: '#666' }}>Loading partnership data…</p>
          </div>
        )}

        {!loading && data?.no_partners && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🤝</div>
            <h2 style={{ color: '#E8E8F0', marginBottom: 12 }}>No active partnerships yet</h2>
            <p style={{ color: '#888', maxWidth: 480, textAlign: 'center', lineHeight: 1.6 }}>
              This dashboard publishes resolution statistics only for wards where MapMyCity has
              a signed municipal partnership. We don't display implied engagement for areas
              without a confirmed partner — that's by design.
            </p>
            <p style={{ color: '#6C63FF', marginTop: 16, fontSize: 14 }}>
              Municipal partners: reach out at <strong>partnerships@mapmycity.in</strong>
            </p>
          </div>
        )}

        {!loading && data && data.wards.length > 0 && (
          <>
            {/* ── Summary banner ── */}
            <div style={styles.summaryBanner}>
              <div style={styles.summaryItem}>
                <span style={styles.summaryNumber}>{data.wards.length}</span>
                <span style={styles.summaryLabel}>Partnered wards</span>
              </div>
              <div style={styles.summaryDivider} />
              <div style={styles.summaryItem}>
                <span style={styles.summaryNumber}>
                  {Math.round(data.wards.reduce((a, w) => a + w.sla_met_pct, 0) / data.wards.length)}%
                </span>
                <span style={styles.summaryLabel}>Avg SLA compliance</span>
              </div>
              <div style={styles.summaryDivider} />
              <div style={styles.summaryItem}>
                <span style={styles.summaryNumber}>
                  {data.wards.reduce((a, w) => a + w.total_resolved, 0).toLocaleString()}
                </span>
                <span style={styles.summaryLabel}>Issues resolved this quarter</span>
              </div>
            </div>

            {/* ── Ward cards ── */}
            <div style={styles.grid}>
              {data.wards.map(ward => (
                <div key={ward.ward_id} style={styles.wardCard}>
                  <div style={styles.wardHeader}>
                    <div>
                      <h3 style={styles.wardName}>{ward.ward_name}</h3>
                      <p style={styles.wardCity}>{ward.city} · {ward.partner_name}</p>
                      <p style={styles.wardQuarter}>{ward.quarter}</p>
                    </div>
                    <SLAGauge pct={Math.round(ward.sla_met_pct)} />
                  </div>
                  <div style={styles.wardStats}>
                    <div style={styles.statCell}>
                      <span style={styles.statNumber}>{ward.total_resolved}</span>
                      <span style={styles.statLabel}>Resolved</span>
                    </div>
                    <div style={styles.statCell}>
                      <span style={styles.statNumber}>{ward.active_issues}</span>
                      <span style={styles.statLabel}>Active</span>
                    </div>
                    <div style={styles.statCell}>
                      <span style={styles.statNumber}>{ward.avg_resolution_hours}h</span>
                      <span style={styles.statLabel}>Avg resolution</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Methodology note ── */}
        <div style={styles.methodologyNote}>
          <strong style={{ color: '#6C63FF' }}>Methodology: </strong>
          SLA compliance is measured against the target resolution window agreed with each
          municipal partner. Only wards with an active signed MoU appear here. Data is updated
          daily from the partner's resolution event feed. Issues without a partner resolution
          event are counted as unresolved regardless of their age.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0F0F1A', color: '#E8E8F0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { backgroundColor: '#1A1A2E', borderBottom: '1px solid #252540', padding: '24px 32px' },
  headerInner: { maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' },
  logo: { fontSize: 24, fontWeight: 800, marginRight: 8, whiteSpace: 'nowrap' as const },
  pageTitle: { fontSize: 22, fontWeight: 700, margin: 0, color: '#E8E8F0' },
  pageSubtitle: { fontSize: 13, color: '#888', margin: '4px 0 0' },
  benchmarkLink: { marginLeft: 'auto', color: '#6C63FF', textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const },
  content: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  emptyState: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '80px 24px' },
  spinner: { width: 40, height: 40, borderRadius: '50%', border: '3px solid #252540', borderTopColor: '#6C63FF', animation: 'spin 0.8s linear infinite', marginBottom: 16 },
  summaryBanner: { display: 'flex', gap: 0, backgroundColor: '#1A1A2E', borderRadius: 16, border: '1px solid #252540', marginBottom: 32, overflow: 'hidden' },
  summaryItem: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '24px 16px', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: '#252540' },
  summaryNumber: { fontSize: 36, fontWeight: 800, color: '#6C63FF' },
  summaryLabel: { fontSize: 12, color: '#888', textAlign: 'center' as const },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 },
  wardCard: { backgroundColor: '#1A1A2E', borderRadius: 16, border: '1px solid #252540', padding: 20 },
  wardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  wardName: { fontSize: 17, fontWeight: 700, margin: 0, color: '#E8E8F0' },
  wardCity: { fontSize: 12, color: '#888', margin: '4px 0 2px' },
  wardQuarter: { fontSize: 11, color: '#555' },
  wardStats: { display: 'flex', gap: 0, backgroundColor: '#0F0F1A', borderRadius: 10, overflow: 'hidden' },
  statCell: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '12px 8px', gap: 2 },
  statNumber: { fontSize: 20, fontWeight: 700, color: '#E8E8F0' },
  statLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  methodologyNote: { backgroundColor: '#1A1A2E', border: '1px solid #252540', borderRadius: 10, padding: '16px 20px', fontSize: 13, color: '#888', lineHeight: 1.7 },
};
