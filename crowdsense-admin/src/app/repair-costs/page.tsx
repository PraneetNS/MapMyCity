'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ContractorBid {
  id: string;
  contractor_name: string;
  contractor_license_no: string;
  bid_amount_inr: number;
  proposed_duration_hours: number;
  warranty_months: number;
  asphalt_mix_grade: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export default function RepairCostsAdminPage() {
  const [activeTab, setActiveTab] = useState<'CALCULATOR' | 'BIDS' | 'INVENTORY'>('CALCULATOR');
  
  // Interactive Calculator State
  const [area, setArea] = useState<number>(2.4);
  const [depth, setDepth] = useState<number>(6.5);
  const [trafficTier, setTrafficTier] = useState<string>('MEDIUM');
  const [emergencyPatch, setEmergencyPatch] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);

  // Contractor Bids State
  const [bids, setBids] = useState<ContractorBid[]>([
    {
      id: 'bid-201',
      contractor_name: 'Apex Urban Roadworks Ltd.',
      contractor_license_no: 'KA-PWD-CL1-4821',
      bid_amount_inr: 12450.0,
      proposed_duration_hours: 4.5,
      warranty_months: 18,
      asphalt_mix_grade: 'VG-30_BITUMEN_CONCRETE',
      status: 'SUBMITTED',
      created_at: '2026-10-20T10:15:00Z',
    },
    {
      id: 'bid-202',
      contractor_name: 'Metro Smart Roads & Civilworks JV',
      contractor_license_no: 'BBMP-ENG-A-9902',
      bid_amount_inr: 11800.0,
      proposed_duration_hours: 3.5,
      warranty_months: 24,
      asphalt_mix_grade: 'VG-40_MODIFIED_POLYMER',
      status: 'SUBMITTED',
      created_at: '2026-10-20T11:40:00Z',
    },
    {
      id: 'bid-203',
      contractor_name: 'Kaveri Civic Infrastructure Enterprise',
      contractor_license_no: 'KA-PWD-CL2-1108',
      bid_amount_inr: 13900.0,
      proposed_duration_hours: 5.0,
      warranty_months: 12,
      asphalt_mix_grade: 'VG-30_BITUMEN_CONCRETE',
      status: 'SUBMITTED',
      created_at: '2026-10-20T13:20:00Z',
    },
  ]);

  const [notification, setNotification] = useState<string | null>(null);

  // Perform calculation
  const runCalculation = async () => {
    setCalcLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/repair-costs/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface_area_sqm: area,
          depth_cm: depth,
          traffic_tier: trafficTier,
          emergency_patch: emergencyPatch,
          contingency_pct: 10.0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
      } else {
        fallbackCalculation();
      }
    } catch {
      fallbackCalculation();
    } finally {
      setCalcLoading(false);
    }
  };

  const fallbackCalculation = () => {
    const engineeredArea = Number((area * 1.15).toFixed(2));
    const depthM = depth / 100.0;
    const vol = Number((engineeredArea * depthM).toFixed(4));
    const asphaltKg = Number((vol * 2400.0).toFixed(1));
    const tackKg = Number((engineeredArea * 0.25).toFixed(1));
    const matCost = emergencyPatch ? (asphaltKg / 1000) * 6200 + tackKg * 78 : (asphaltKg / 1000) * 4850 + tackKg * 78;
    const labor = 3.5 * 850;
    const equip = 2.0 * 950 + 1500;
    const mult = trafficTier === 'HEAVY_CORRIDOR' ? 1.4 : trafficTier === 'HIGH' ? 1.25 : 1.1;
    const total = Number(((matCost + labor + equip) * mult * 1.1).toFixed(2));

    setCalcResult({
      surface_area_sqm: engineeredArea,
      depth_cm: depth,
      estimated_volume_cum: vol,
      materials_breakdown: {
        asphalt_mix_kg: asphaltKg,
        asphalt_mix_tonnes: Number((asphaltKg / 1000).toFixed(3)),
        tack_coat_emulsion_kg: tackKg,
        granular_subbase_kg: depth > 6 ? 120.0 : 0.0,
        needs_base_course_reinstatement: depth > 6,
        mix_grade: emergencyPatch ? 'COLD_PATCH_POLYMER' : 'VG-30_BITUMINOUS_CONCRETE',
      },
      financial_breakdown_inr: {
        materials_cost: Math.round(matCost),
        labor_cost: Math.round(labor),
        equipment_and_mobilization_cost: Math.round(equip),
        total_estimated_cost: total,
      },
      operational_estimates: {
        estimated_repair_duration_hours: 3.5,
        roller_compaction_hours: 2.0,
        recommended_crew_size: 4,
      },
      environmental_impact: {
        embodied_carbon_kg_co2e: Number((asphaltKg * 0.052).toFixed(1)),
      },
    });
  };

  useEffect(() => {
    runCalculation();
  }, [area, depth, trafficTier, emergencyPatch]);

  const handleAwardBid = (bidId: string, contractorName: string) => {
    setBids((prev) =>
      prev.map((b) => {
        if (b.id === bidId) {
          return { ...b, status: 'ACCEPTED' };
        }
        return { ...b, status: 'REJECTED' };
      })
    );
    setNotification(`Contract successfully awarded to "${contractorName}". Official work order and BOM dispatched.`);
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F8FAFC', padding: '32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Navigation & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link
              href="/"
              style={{
                color: '#38BDF8',
                fontSize: 14,
                textDecoration: 'none',
                background: '#1E293B',
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #334155',
              }}
            >
              ← Validation Map
            </Link>
            <Link
              href="/dispatch"
              style={{
                color: '#38BDF8',
                fontSize: 14,
                textDecoration: 'none',
                background: '#1E293B',
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #334155',
              }}
            >
              Dispatch Console →
            </Link>
          </div>
          <span
            style={{
              background: '#0284C7',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 20,
            }}
          >
            CPWD DSR 2024 STANDARD
          </span>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
            Municipal Repair Cost & Contractor Bidding Console
          </h1>
          <p style={{ color: '#94A3B8', marginTop: 6, fontSize: 14 }}>
            AI-powered Bill of Materials (BOM) estimation, MoRTH 500 specifications, and competitive tender award.
          </p>
        </div>

        {notification && (
          <div
            style={{
              background: '#064E3B',
              border: '1px solid #059669',
              color: '#A7F3D0',
              padding: '12px 18px',
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ✓ {notification}
          </div>
        )}

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <div style={{ background: '#1E293B', padding: 20, borderRadius: 12, border: '1px solid #334155' }}>
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Total Projected Repair Budget</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981' }}>₹1,48,200</div>
            <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Across 18 identified defect clusters</div>
          </div>
          <div style={{ background: '#1E293B', padding: 20, borderRadius: 12, border: '1px solid #334155' }}>
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Asphalt Mix Required</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#38BDF8' }}>14.8 MT</div>
            <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Bituminous Concrete VG-30</div>
          </div>
          <div style={{ background: '#1E293B', padding: 20, borderRadius: 12, border: '1px solid #334155' }}>
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Competitive Bids Received</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F59E0B' }}>{bids.length}</div>
            <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>PWD Class-1 & Class-2 Vendors</div>
          </div>
          <div style={{ background: '#1E293B', padding: 20, borderRadius: 12, border: '1px solid #334155' }}>
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Avg Warranty Period</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#A78BFA' }}>18 Mos</div>
            <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Defect liability period coverage</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid #334155', paddingBottom: 12, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('CALCULATOR')}
            style={{
              background: activeTab === 'CALCULATOR' ? '#0284C7' : '#1E293B',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Interactive BOM Calculator
          </button>
          <button
            onClick={() => setActiveTab('BIDS')}
            style={{
              background: activeTab === 'BIDS' ? '#0284C7' : '#1E293B',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Contractor Tenders & Bids ({bids.length})
          </button>
          <button
            onClick={() => setActiveTab('INVENTORY')}
            style={{
              background: activeTab === 'INVENTORY' ? '#0284C7' : '#1E293B',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ward Material Allocations
          </button>
        </div>

        {/* Tab 1: Interactive Calculator */}
        {activeTab === 'CALCULATOR' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Input Form */}
            <div style={{ background: '#1E293B', padding: 24, borderRadius: 12, border: '1px solid #334155' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: '#F8FAFC' }}>
                Defect Parameters & Sizing
              </h2>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6 }}>
                  Surface Area: <strong style={{ color: '#F8FAFC' }}>{area} m²</strong>
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="15.0"
                  step="0.1"
                  value={area}
                  onChange={(e) => setArea(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6 }}>
                  Defect Depth: <strong style={{ color: '#F8FAFC' }}>{depth} cm</strong> {depth > 6 && '(Requires Granular Subbase)'}
                </label>
                <input
                  type="range"
                  min="2.0"
                  max="20.0"
                  step="0.5"
                  value={depth}
                  onChange={(e) => setDepth(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6 }}>
                  Traffic Classification
                </label>
                <select
                  value={trafficTier}
                  onChange={(e) => setTrafficTier(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0B1120',
                    border: '1px solid #475569',
                    color: '#F8FAFC',
                    padding: '10px 12px',
                    borderRadius: 6,
                  }}
                >
                  <option value="LOW">Low (Residential Street, 1.0x)</option>
                  <option value="MEDIUM">Medium (Urban Collector, 1.1x)</option>
                  <option value="HIGH">High (Primary Arterial, 1.25x)</option>
                  <option value="HEAVY_CORRIDOR">Heavy Corridor (Transit Trunk, 1.4x)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
                <input
                  type="checkbox"
                  id="emergency"
                  checked={emergencyPatch}
                  onChange={(e) => setEmergencyPatch(e.target.checked)}
                />
                <label htmlFor="emergency" style={{ fontSize: 14, color: '#F8FAFC', cursor: 'pointer' }}>
                  Emergency All-Weather Cold Patch (Monsoon instant curing)
                </label>
              </div>
            </div>

            {/* Results Output */}
            {calcResult && (
              <div style={{ background: '#1E293B', padding: 24, borderRadius: 12, border: '1px solid #059669' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: '#F8FAFC' }}>
                  Bill of Materials (BOM) & Budget
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: '#0B1120', padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Asphalt Mix Required</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>
                      {calcResult.materials_breakdown.asphalt_mix_kg} kg
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>({calcResult.materials_breakdown.asphalt_mix_tonnes} MT)</div>
                  </div>

                  <div style={{ background: '#0B1120', padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Tack Coat (RS-1)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>
                      {calcResult.materials_breakdown.tack_coat_emulsion_kg} kg
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Rapid Setting Bitumen</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #334155', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#94A3B8' }}>
                    <span>Materials Cost:</span>
                    <strong style={{ color: '#F8FAFC' }}>₹{calcResult.financial_breakdown_inr.materials_cost.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#94A3B8' }}>
                    <span>Labor (Paving Crew):</span>
                    <strong style={{ color: '#F8FAFC' }}>₹{calcResult.financial_breakdown_inr.labor_cost.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#94A3B8' }}>
                    <span>Compactor Roller & Equipment:</span>
                    <strong style={{ color: '#F8FAFC' }}>₹{calcResult.financial_breakdown_inr.equipment_and_mobilization_cost.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #334155', fontSize: 18 }}>
                    <span style={{ fontWeight: 700 }}>Total Estimated Cost:</span>
                    <strong style={{ color: '#10B981', fontWeight: 800 }}>
                      ₹{calcResult.financial_breakdown_inr.total_estimated_cost.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Contractor Bids */}
        {activeTab === 'BIDS' && (
          <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                  <th style={{ padding: '14px 18px' }}>Contractor & License</th>
                  <th style={{ padding: '14px 18px' }}>Bid Amount</th>
                  <th style={{ padding: '14px 18px' }}>Duration</th>
                  <th style={{ padding: '14px 18px' }}>Warranty</th>
                  <th style={{ padding: '14px 18px' }}>Mix Grade</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{b.contractor_name}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{b.contractor_license_no}</div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#10B981' }}>
                      ₹{b.bid_amount_inr.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#F8FAFC' }}>{b.proposed_duration_hours} hrs</td>
                    <td style={{ padding: '14px 18px', color: '#F8FAFC' }}>{b.warranty_months} months</td>
                    <td style={{ padding: '14px 18px', color: '#38BDF8', fontSize: 12 }}>{b.asphalt_mix_grade}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          background:
                            b.status === 'ACCEPTED'
                              ? '#064E3B'
                              : b.status === 'REJECTED'
                              ? '#7F1D1D'
                              : '#1E3A8A',
                          color:
                            b.status === 'ACCEPTED'
                              ? '#A7F3D0'
                              : b.status === 'REJECTED'
                              ? '#FCA5A5'
                              : '#93C5FD',
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {b.status === 'SUBMITTED' ? (
                        <button
                          onClick={() => handleAwardBid(b.id, b.contractor_name)}
                          style={{
                            background: '#059669',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Award Tender
                        </button>
                      ) : (
                        <span style={{ color: '#64748B', fontSize: 12 }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Ward Inventory */}
        {activeTab === 'INVENTORY' && (
          <div style={{ background: '#1E293B', padding: 24, borderRadius: 12, border: '1px solid #334155' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: '#F8FAFC' }}>
              Projected Material Requisitions by Municipal Ward
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { ward: 'Ward 150 (Bellandur)', defects: 8, asphalt_mt: 6.2, tack_kg: 84, budget: 62400 },
                { ward: 'Ward 174 (HSR Layout)', defects: 5, asphalt_mt: 4.1, tack_kg: 56, budget: 41200 },
                { ward: 'Ward 085 (Doddanekkundi)', defects: 3, asphalt_mt: 2.7, tack_kg: 38, budget: 27800 },
                { ward: 'Ward 101 (Indiranagar)', defects: 2, asphalt_mt: 1.8, tack_kg: 24, budget: 16800 },
              ].map((w) => (
                <div
                  key={w.ward}
                  style={{
                    background: '#0B1120',
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{w.ward}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                      {w.defects} clusters • {w.asphalt_mt} MT Bitumen • {w.tack_kg} kg Emulsion
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>
                      ₹{w.budget.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 2 }}>Ready for Tender</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
