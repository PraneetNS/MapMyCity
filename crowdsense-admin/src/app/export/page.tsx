'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function ExportDataPage() {
  const [wardId, setWardId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(500);
  const [isExporting, setIsExporting] = useState(false);

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'pothole', label: 'Pothole & Road Damage' },
    { value: 'garbage', label: 'Garbage / Waste' },
    { value: 'infrastructure', label: 'Streetlight / Utility' },
    { value: 'accessibility', label: 'Accessibility / Sidewalk' },
    { value: 'safety_concern', label: 'Safety Hazard' },
  ];

  const statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
  ];

  const buildExportUrl = (format: 'geojson' | 'csv') => {
    const params = new URLSearchParams();
    if (wardId) params.set('ward_id', wardId);
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    params.set('limit', limit.toString());
    return `${API_BASE}/api/v1/export/${format}?${params.toString()}`;
  };

  const handleDownload = (format: 'geojson' | 'csv') => {
    setIsExporting(true);
    const url = buildExportUrl(format);
    window.open(url, '_blank');
    setTimeout(() => setIsExporting(false), 1000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090D16', color: '#F8FAFC', padding: '32px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <a href="/" style={{ color: '#38BDF8', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
            &larr; Back to Admin Dashboard
          </a>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 8px 0' }}>
            Civic Data Export Hub
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
            Download verified spatial clusters and civic defect records for GIS analysis (QGIS, ArcGIS), research, or municipal reporting.
          </p>
        </div>

        {/* Filter Card */}
        <div style={{ backgroundColor: '#131B2E', borderRadius: '12px', border: '1px solid #1E293B', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#E2E8F0', marginTop: 0, marginBottom: '20px' }}>
            Filter Export Dataset
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Ward ID</label>
              <input
                type="text"
                placeholder="e.g. Ward-K-West or all"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                style={{ width: '100%', backgroundColor: '#0B1120', border: '1px solid #334155', color: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', backgroundColor: '#0B1120', border: '1px solid #334155', color: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%', backgroundColor: '#0B1120', border: '1px solid #334155', color: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Record Limit</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ width: '100%', backgroundColor: '#0B1120', border: '1px solid #334155', color: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value={100}>100 records</option>
                <option value={500}>500 records</option>
                <option value={1000}>1,000 records</option>
                <option value={5000}>5,000 records</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleDownload('geojson')}
              disabled={isExporting}
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Export GeoJSON (RFC 7946)
            </button>

            <button
              onClick={() => handleDownload('csv')}
              disabled={isExporting}
              style={{
                backgroundColor: '#1E293B',
                color: '#E2E8F0',
                border: '1px solid #334155',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Export CSV Spreadsheet
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div style={{ backgroundColor: '#1E293B55', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#93C5FD', marginTop: 0, marginBottom: '8px' }}>
            Spatial Data Specifications
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#94A3B8', fontSize: '13px', lineHeight: '1.6' }}>
            <li>GeoJSON coordinates are formatted in WGS84 (EPSG:4326) [Longitude, Latitude].</li>
            <li>All personal identifiers and device fingerprints are automatically stripped to safeguard citizen privacy.</li>
            <li>For programmatic automated ingestion, request an API key at <code style={{ color: '#38BDF8' }}>/api/v1/public/register-key</code>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
