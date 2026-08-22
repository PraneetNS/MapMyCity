'use client';
/**
 * Cross-City Benchmarking View — Part 6 (Future Backlog)
 *
 * PRECONDITION GATE: Only renders cities where `is_benchmark_eligible = true`
 * in `partner_organisations`. Requires manual admin opt-in per city.
 * Minimum 2 eligible cities required before this page is meaningful.
 *
 * See FUTURE_BACKLOG.md Part 6: at least 2 cities, each with 200+ submissions
 * and 90+ days of data required.
 *
 * METHODOLOGY CAVEAT (shown prominently in UI):
 * Raw resolution times across cities of very different size, budget, and density
 * are unfair comparisons. All metrics here normalize by reports_per_1000_population.
 */

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface CityBenchmark {
  city_id: string;
  city_name: string;
  population: number;
  total_reports: number;
  reports_per_1000: number;         // Normalized metric
  avg_resolution_hours: number;
  sla_compliance_pct: number;
  top_category: string;
  active_issues: number;
  is_benchmark_eligible: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  pothole: '🕳️ Potholes', garbage: '🗑️ Garbage', noise: '🔊 Noise',
  accessibility: '♿ Accessibility', infrastructure: '🏗️ Infrastructure',
  passive_road_quality: '🛣️ Road Quality', safety_concern: '🔒 Safety',
};

async function fetchBenchmarks(): Promise<{ cities: CityBenchmark[]; insufficient_data: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/benchmarks`, { cache: 'no-store' });
    if (!res.ok) return { cities: [], insufficient_data: true };
    return await res.json();
  } catch {
    return { cities: [], insufficient_data: true };
  }
}

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 6, backgroundColor: '#1A1A2E', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const bg = colors[rank - 1] ?? '#333';
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: bg + '30', border: `2px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: bg }}>
      {rank}
    </div>
  );
}

export default function BenchmarksPage() {
  const [data, setData] = useState<{ cities: CityBenchmark[]; insufficient_data: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'sla' | 'speed' | 'volume'>('sla');

  useEffect(() => {
    fetchBenchmarks().then(d => { setData(d); setLoading(false); });
  }, []);

  const sortedCities = data?.cities
    ? [...data.cities].sort((a, b) => {
        if (sortBy === 'sla') return b.sla_compliance_pct - a.sla_compliance_pct;
        if (sortBy === 'speed') return a.avg_resolution_hours - b.avg_resolution_hours;
        return b.reports_per_1000 - a.reports_per_1000;
      })
    : [];

  const maxResolution = Math.max(...(sortedCities.map(c => c.avg_resolution_hours) ?? [1]));
  const maxVolume = Math.max(...(sortedCities.map(c => c.reports_per_1000) ?? [1]));

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>🗺️ MapMyCity</span>
          <div>
            <h1 style={styles.pageTitle}>Cross-City Benchmarks</h1>
            <p style={styles.pageSubtitle}>
              Civic issue resolution compared across onboarded cities · Normalised by population
            </p>
          </div>
          <a href="/public-sla" style={styles.slaLink}>← SLA Dashboard</a>
        </div>
      </div>

      <div style={styles.content}>
        {/* ── METHODOLOGY CAVEAT — always visible ── */}
        <div style={styles.methodologyBox}>
          <span style={styles.methodologyIcon}>ℹ️</span>
          <div>
            <strong style={{ color: '#FFD166' }}>Comparison methodology</strong>
            <p style={{ margin: '4px 0 0', color: '#9898C0', lineHeight: 1.6, fontSize: 13 }}>
              Raw resolution times and report volumes vary significantly by city budget, population density,
              and municipal capacity. All volume metrics are <strong>normalised per 1,000 population</strong>.
              Resolution time comparisons should be interpreted in that context — a smaller city with
              fewer resources is not directly comparable to a metro. Cities must opt in via a signed
              partnership agreement before appearing here.
            </p>
          </div>
        </div>

        {loading && (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p style={{ color: '#666' }}>Loading benchmark data…</p>
          </div>
        )}

        {!loading && data?.insufficient_data && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
            <h2 style={{ color: '#E8E8F0', marginBottom: 12 }}>Not enough cities yet</h2>
            <p style={{ color: '#888', maxWidth: 520, textAlign: 'center', lineHeight: 1.6 }}>
              Cross-city benchmarking requires at least 2 cities, each with 200+ submissions
              spanning 90+ days, and an active partnership agreement.
              A single-city benchmarking view would be meaningless — check back as more
              cities onboard.
            </p>
            <a href="/public-sla" style={{ ...styles.slaLink, marginTop: 20, display: 'inline-block' }}>
              View SLA dashboard for current partners →
            </a>
          </div>
        )}

        {!loading && sortedCities.length >= 2 && (
          <>
            {/* ── Sort controls ── */}
            <div style={styles.sortRow}>
              <span style={{ color: '#666', fontSize: 13 }}>Sort by:</span>
              {(['sla', 'speed', 'volume'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  style={{ ...styles.sortBtn, ...(sortBy === s ? styles.sortBtnActive : {}) }}>
                  {s === 'sla' ? '🏆 SLA compliance' : s === 'speed' ? '⚡ Resolution speed' : '📈 Report volume'}
                </button>
              ))}
            </div>

            {/* ── City comparison table ── */}
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>City</th>
                    <th style={styles.th}>SLA compliance</th>
                    <th style={styles.th}>Avg resolution</th>
                    <th style={styles.th}>Reports / 1k pop</th>
                    <th style={styles.th}>Top category</th>
                    <th style={styles.th}>Active issues</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCities.map((city, idx) => (
                    <tr key={city.city_id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td style={styles.td}><RankBadge rank={idx + 1} /></td>
                      <td style={styles.td}>
                        <span style={styles.cityName}>{city.city_name}</span>
                        <span style={styles.cityPop}>{(city.population / 1e6).toFixed(1)}M pop.</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: city.sla_compliance_pct >= 80 ? '#06D6A0' : city.sla_compliance_pct >= 60 ? '#FFD166' : '#FF6B6B', fontWeight: 700 }}>
                          {city.sla_compliance_pct.toFixed(1)}%
                        </span>
                        <MetricBar value={city.sla_compliance_pct} max={100} color="#6C63FF" />
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: '#E8E8F0', fontWeight: 600 }}>{city.avg_resolution_hours}h</span>
                        <MetricBar value={maxResolution - city.avg_resolution_hours} max={maxResolution} color="#06D6A0" />
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: '#E8E8F0' }}>{city.reports_per_1000.toFixed(2)}</span>
                        <MetricBar value={city.reports_per_1000} max={maxVolume} color="#FFD166" />
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, color: '#9898C0' }}>
                          {CATEGORY_LABELS[city.top_category] ?? city.top_category}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: '#FF6B6B', fontWeight: 600 }}>{city.active_issues.toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={styles.dataNote}>
              Data updates daily. Only cities with signed partnership agreements and sufficient
              data volume are included. Methodology caveated above applies to all comparisons.
            </p>
          </>
        )}

        {!loading && sortedCities.length === 1 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏙️</div>
            <p style={{ color: '#888', textAlign: 'center' }}>
              Only 1 city is currently eligible. Cross-city comparison requires at least 2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0F0F1A', color: '#E8E8F0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { backgroundColor: '#1A1A2E', borderBottom: '1px solid #252540', padding: '24px 32px' },
  headerInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' },
  logo: { fontSize: 24, fontWeight: 800, whiteSpace: 'nowrap' },
  pageTitle: { fontSize: 22, fontWeight: 700, margin: 0, color: '#E8E8F0' },
  pageSubtitle: { fontSize: 13, color: '#888', margin: '4px 0 0' },
  slaLink: { marginLeft: 'auto', color: '#6C63FF', textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  content: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  methodologyBox: { display: 'flex', gap: 14, backgroundColor: '#1A1A2E', border: '1px solid #FFD16640', borderRadius: 12, padding: '16px 20px', marginBottom: 28 },
  methodologyIcon: { fontSize: 20, flexShrink: 0, marginTop: 2 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px' },
  spinner: { width: 40, height: 40, borderRadius: '50%', border: '3px solid #252540', borderTopColor: '#6C63FF', marginBottom: 16 },
  sortRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  sortBtn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #333', backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  sortBtnActive: { borderColor: '#6C63FF', backgroundColor: '#6C63FF20', color: '#6C63FF' },
  tableWrap: { overflowX: 'auto', borderRadius: 14, border: '1px solid #252540', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: 700 },
  thead: { backgroundColor: '#1A1A2E' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #252540' },
  td: { padding: '14px 16px', verticalAlign: 'middle', borderBottom: '1px solid #1A1A2E' },
  trEven: { backgroundColor: '#0F0F1A' },
  trOdd: { backgroundColor: '#111120' },
  cityName: { display: 'block', fontWeight: 700, color: '#E8E8F0', fontSize: 14 },
  cityPop: { display: 'block', fontSize: 11, color: '#555', marginTop: 2 },
  dataNote: { color: '#555', fontSize: 12, textAlign: 'center', lineHeight: 1.6 },
};
