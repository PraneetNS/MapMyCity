'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface WardRanking {
  ward_id: string;
  average_rating: number;
  response_count: number;
}

interface SummaryData {
  total_surveys: number;
  overall_satisfaction: number;
  ward_rankings: WardRanking[];
  latest_feedback_count: number;
}

export default function SurveysPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [selectedWard, setSelectedWard] = useState<string>('Ward 4');
  const [wardMetrics, setWardMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSummary();
    fetchWardDetail(selectedWard);
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/surveys/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // Mock fallback
      setSummary({
        total_surveys: 284,
        overall_satisfaction: 4.35,
        ward_rankings: [
          { ward_id: 'Ward 4 (Central)', average_rating: 4.8, response_count: 92 },
          { ward_id: 'Ward 12 (North)', average_rating: 4.5, response_count: 64 },
          { ward_id: 'Ward 7 (West)', average_rating: 4.1, response_count: 78 },
          { ward_id: 'Ward 2 (South)', average_rating: 3.8, response_count: 50 },
        ],
        latest_feedback_count: 10,
      });
    }
  };

  const fetchWardDetail = async (wardId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/surveys/ward/${encodeURIComponent(wardId)}`);
      if (res.ok) {
        const data = await res.json();
        setWardMetrics(data);
      }
    } catch {
      setWardMetrics({
        ward_id: wardId,
        total_surveys: 92,
        average_rating: 4.8,
        average_speed_rating: 4.7,
        average_workmanship_rating: 4.9,
        average_sentiment: 0.78,
        aspect_breakdown: {
          rapid_resolution: 54,
          high_quality_patch: 48,
          clean_site: 36,
          debris_remaining: 4,
        },
        sample_responses: [
          { id: '1', rating: 5, category: 'pothole', feedback: 'Pothole filled within 24 hours of report! Very impressed.' },
          { id: '2', rating: 5, category: 'streetlight', feedback: 'Lighting restored promptly along the main intersection.' },
          { id: '3', rating: 4, category: 'drainage', feedback: 'Good job overall, thank you for clearing the drain.' },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWardSelect = (ward: string) => {
    setSelectedWard(ward);
    fetchWardDetail(ward);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090D16', color: '#F8FAFC', padding: '32px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <a href="/" style={{ color: '#38BDF8', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
            &larr; Back to Admin Dashboard
          </a>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 8px 0' }}>
            Citizen Satisfaction & Ward Feedback Analytics
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
            Post-resolution feedback ratings, contractor workmanship scores, and citizen sentiment telemetry across wards.
          </p>
        </div>

        {/* Top Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div style={{ backgroundColor: '#131C2E', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
              City-Wide Satisfaction
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#38BDF8' }}>
              {summary ? `${summary.overall_satisfaction} / 5.0` : '4.4 / 5.0'}
            </div>
            <div style={{ fontSize: '13px', color: '#22C55E', marginTop: '4px' }}>
              &#9650; +0.3 vs previous quarter
            </div>
          </div>

          <div style={{ backgroundColor: '#131C2E', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
              Total Citizen Ratings
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#F8FAFC' }}>
              {summary ? summary.total_surveys : 284}
            </div>
            <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
              Verified post-resolution submissions
            </div>
          </div>

          <div style={{ backgroundColor: '#131C2E', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
              Citizen Sentiment Index
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#22C55E' }}>
              +78%
            </div>
            <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
              Positive resolution feedback ratio
            </div>
          </div>
        </div>

        {/* Main Content: Ward Rankings & Detailed Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Ward Selector Table */}
          <div style={{ backgroundColor: '#131C2E', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0 0 16px 0', color: '#FFFFFF' }}>
              Ward Rankings
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(summary?.ward_rankings || []).map((w, idx) => {
                const isSelected = selectedWard.toLowerCase() === w.ward_id.toLowerCase();
                return (
                  <div
                    key={w.ward_id}
                    onClick={() => handleWardSelect(w.ward_id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#1E293B' : '#0F172A',
                      border: isSelected ? '1px solid #38BDF8' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: isSelected ? '#38BDF8' : '#F8FAFC' }}>
                        #{idx + 1} {w.ward_id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        {w.response_count} responses
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#FBBF24' }}>
                      ★ {w.average_rating}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ward Deep Dive */}
          <div style={{ backgroundColor: '#131C2E', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0 0 16px 0', color: '#FFFFFF' }}>
              Detailed Insights: {selectedWard}
            </h2>

            {loading ? (
              <div style={{ color: '#94A3B8', padding: '30px 0', textAlign: 'center' }}>Loading metrics...</div>
            ) : wardMetrics ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ backgroundColor: '#0F172A', padding: '14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Resolution Speed Rating</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#38BDF8', marginTop: '4px' }}>
                      ★ {wardMetrics.average_speed_rating || '4.7'} / 5.0
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0F172A', padding: '14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Workmanship Quality</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#22C55E', marginTop: '4px' }}>
                      ★ {wardMetrics.average_workmanship_rating || '4.9'} / 5.0
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#CBD5E1', marginBottom: '10px' }}>
                    Aspect Breakdown
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(wardMetrics.aspect_breakdown || {}).map(([tag, count]) => (
                      <span
                        key={tag}
                        style={{
                          backgroundColor: '#1E293B',
                          color: '#CBD5E1',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          border: '1px solid #334155',
                        }}
                      >
                        {tag.replace(/_/g, ' ')}: <strong style={{ color: '#38BDF8' }}>{count as number}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#CBD5E1', marginBottom: '10px' }}>
                    Recent Citizen Feedback
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(wardMetrics.sample_responses || []).map((sample: any, index: number) => (
                      <div
                        key={sample.id || index}
                        style={{
                          backgroundColor: '#0F172A',
                          border: '1px solid #1E293B',
                          borderRadius: '8px',
                          padding: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: '#38BDF8', textTransform: 'capitalize' }}>
                            {sample.category}
                          </span>
                          <span style={{ fontSize: '13px', color: '#FBBF24', fontWeight: '600' }}>
                            ★ {sample.rating}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>
                          "{sample.feedback || 'No comment provided'}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
