"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  Camera, 
  MapPin, 
  Table, 
  Map as MapIcon, 
  AlertTriangle, 
  Check, 
  X, 
  RefreshCw, 
  LogOut, 
  ShieldAlert, 
  CheckCircle,
  BarChart3,
  TrendingUp,
  Percent,
  Layers,
  Users,
  Sparkles,
  Activity,
  Flame,
  Info
} from 'lucide-react';


const API_BASE_URL = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? 'http://127.0.0.1:8000' : 'http://127.0.0.1:8000') // Adjust base API URL as needed
  : 'http://127.0.0.1:8000';

interface Submission {
  id: string;
  device_id: string;
  mission_type: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  captured_at: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  p_hash?: string | null;
  flags?: string[] | null;
}

interface Cluster {
  id: string;
  mission_type: string;
  latitude: number;
  longitude: number;
  first_reported_at: string;
  last_reported_at: string;
  status: 'active' | 'resolved' | 'stale';
  submission_count: number;
}

export default function Home() {
  // --- Password Gate State ---
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState('');

  // --- App State ---
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [prioritizedClusters, setPrioritizedClusters] = useState<any[]>([]);
  const [recurrenceModalData, setRecurrenceModalData] = useState<any | null>(null);
  const [deviceTrustScores, setDeviceTrustScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prioritized' | 'table' | 'map' | 'flagged' | 'safety' | 'accessibility' | 'utilities'>('prioritized');
  const [flaggedSubmissions, setFlaggedSubmissions] = useState<any[]>([]);
  const [accessibilityAudits, setAccessibilityAudits] = useState<any[]>([]);
  const [utilityStatusList, setUtilityStatusList] = useState<any[]>([]);
  const [banInput, setBanInput] = useState({ phoneHash: '', reason: '' });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --- Table Filters & Sorts ---
  const [filterMission, setFilterMission] = useState<string>('all');
  const [filterFlags, setFilterFlags] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'captured_at' | 'trust_score'>('captured_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // --- Leaflet Client Load ---
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const LRef = useRef<any>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Load Auth State
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authorized = localStorage.getItem('crowdsense.authorized') === 'true';
      setIsAuthenticated(authorized);
    }
  }, []);

  // Initialize Leaflet client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const L = require('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        LRef.current = L;
        setLeafletLoaded(true);
      } catch (err) {
        console.error("Failed to load Leaflet script:", err);
      }
    }
  }, []);

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Submissions
      const subRes = await fetch(`${API_BASE_URL}/submissions`);
      if (!subRes.ok) throw new Error("Failed to load submissions");
      const subData = await subRes.json();
      setSubmissions(subData);

      // 2. Fetch Clusters
      const clusterRes = await fetch(`${API_BASE_URL}/clusters`);
      if (clusterRes.ok) {
        const clusterData = await clusterRes.json();
        setClusters(clusterData);
      }

      // 3. Fetch Prioritized Clusters with AI Triage Summaries & Recurrence Risk
      try {
        const priorRes = await fetch(`${API_BASE_URL}/admin/clusters/prioritized`);
        if (priorRes.ok) {
          const priorData = await priorRes.json();
          setPrioritizedClusters(priorData);
        }
      } catch (_) {}

      // 4. Fetch device trust scores for unique devices
      const uniqueDeviceIds = Array.from(new Set(subData.map((s: Submission) => s.device_id))) as string[];
      const scores: Record<string, number> = {};
      await Promise.all(uniqueDeviceIds.map(async (id) => {
        try {
          const res = await fetch(`${API_BASE_URL}/devices/${id}/trust-score`);
          if (res.ok) {
            const data = await res.json();
            scores[id] = data.trust_score;
          } else {
            scores[id] = 0.5;
          }
        } catch {
          scores[id] = 0.5;
        }
      }));
      setDeviceTrustScores(scores);

    } catch (err: any) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveCluster = async (cluster: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clusters/${cluster.id}/recurrence-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ past_reopen_count: cluster.reopen_count || 0 })
      });
      const riskData = res.ok ? await res.json() : null;
      if (riskData && riskData.is_high_risk) {
        setRecurrenceModalData({ cluster, riskData });
        return;
      }
    } catch (_) {}

    await executeClusterResolution(cluster.id);
  };

  const executeClusterResolution = async (clusterId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clusters/${clusterId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', changed_by_role: 'admin' })
      });
      if (res.ok) {
        fetchData();
        setRecurrenceModalData(null);
      }
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    }
  };


  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length >= 6) {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crowdsense.authorized', 'true');
        localStorage.setItem('crowdsense.adminToken', `CS_ROLE_TOKEN_${Date.now()}`);
      }
      setAuthError('');
    } else {
      setAuthError('Authentication failed: Password must be at least 6 characters.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crowdsense.authorized');
    }
    setPassword('');
  };

  // --- Decision Handler ---
  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision })
      });
      if (!res.ok) throw new Error("Backend reject/approve failed");
      
      // Update locally
      setSubmissions((prev) => 
        prev.map((item) => item.id === id ? { ...item, status: decision } : item)
      );

      // Refresh clusters since stats change
      const clusterRes = await fetch(`${API_BASE_URL}/clusters`);
      if (clusterRes.ok) {
        const clusterData = await clusterRes.json();
        setClusters(clusterData);
      }
    } catch (err: any) {
      alert(`Decision update failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // --- Render Clusters Map ---
  useEffect(() => {
    if (activeTab !== 'map' || !isAuthenticated || loading || !leafletLoaded) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapRef.current) return;
    const L = LRef.current;

    // 1. Initialize Map
    if (!mapInstanceRef.current) {
      const initialCoords: [number, number] = clusters.length > 0
        ? [clusters[0].latitude, clusters[0].longitude]
        : [37.7749, -122.4194]; // Default SF coordinates

      const map = L.map(mapRef.current).setView(initialCoords, 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // 2. Clear Previous Markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 3. Define color-coded markers by cluster status
    const getMarkerIcon = (status: 'active' | 'resolved' | 'stale') => {
      let color = '#f43f5e'; // active = rose
      if (status === 'resolved') color = '#10b981'; // emerald
      if (status === 'stale') color = '#71717a'; // slate/grey
      
      return L.divIcon({
        className: 'custom-cluster-icon',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    };

    // 4. Add Clusters to Map
    clusters.forEach((cluster) => {
      const marker = L.marker([cluster.latitude, cluster.longitude], {
        icon: getMarkerIcon(cluster.status)
      }).addTo(map);

      const formattedDate = new Date(cluster.last_reported_at).toLocaleDateString();

      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 6px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; text-transform: uppercase; color: #fff; font-weight: 700;">
            ${cluster.mission_type} Cluster
          </h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #a1a1aa; line-height: 1.4;">
            Status: <span style="font-weight: 700; text-transform: capitalize;">${cluster.status}</span><br/>
            Reports Count: <b>${cluster.submission_count}</b><br/>
            Last Activity: ${formattedDate}
          </p>
          <a href="https://www.google.com/maps/search/?api=1&query=${cluster.latitude},${cluster.longitude}" 
             target="_blank" 
             style="color: #06b6d4; font-size: 11px; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
             View on Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 200 });
      markersRef.current.push(marker);
    });

    // Fit bounds
    if (clusters.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.15));
    }

  }, [activeTab, clusters, isAuthenticated, loading, leafletLoaded]);

  // --- Compute Stats ---
  const stats = useMemo(() => {
    const total = submissions.length;
    const approved = submissions.filter((s) => s.status === 'approved').length;
    const rejected = submissions.filter((s) => s.status === 'rejected').length;
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const approvalRate = total > 0 ? (approved / (approved + rejected || 1)) * 100 : 0;

    // Submissions per mission type
    const missionCounts: Record<string, number> = {};
    submissions.forEach((s) => {
      missionCounts[s.mission_type] = (missionCounts[s.mission_type] || 0) + 1;
    });

    // Top flagged devices
    const deviceFlags: Record<string, { count: number; trust: number }> = {};
    submissions.forEach((s) => {
      const flagsCount = s.flags ? s.flags.length : 0;
      if (flagsCount > 0) {
        if (!deviceFlags[s.device_id]) {
          deviceFlags[s.device_id] = { count: 0, trust: deviceTrustScores[s.device_id] || 0.5 };
        }
        deviceFlags[s.device_id].count += flagsCount;
      }
    });

    const topFlaggedDevices = Object.entries(deviceFlags)
      .map(([id, stats]) => ({ id, count: stats.count, trust: stats.trust }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate,
      missionCounts,
      topFlaggedDevices
    };
  }, [submissions, deviceTrustScores]);

  // --- Filtered and Sorted Submissions ---
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        // Only show pending in the verification/action table
        if (sub.status !== 'pending') return false;

        const matchesMission = filterMission === 'all' || sub.mission_type === filterMission;
        const matchesFlags = filterFlags === 'all' 
          ? true 
          : filterFlags === 'flagged' 
            ? (sub.flags && sub.flags.length > 0) 
            : (!sub.flags || sub.flags.length === 0);

        return matchesMission && matchesFlags;
      })
      .sort((a, b) => {
        if (sortKey === 'captured_at') {
          const diff = new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime();
          return sortOrder === 'desc' ? diff : -diff;
        } else {
          const aTrust = deviceTrustScores[a.device_id] || 0.5;
          const bTrust = deviceTrustScores[b.device_id] || 0.5;
          return sortOrder === 'desc' ? bTrust - aTrust : aTrust - bTrust;
        }
      });
  }, [submissions, filterMission, filterFlags, sortKey, sortOrder, deviceTrustScores]);

  const toggleSort = (key: 'captured_at' | 'trust_score') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // --- Render Password Gate ---
  if (!isAuthenticated) {
    return (
      <div className="auth-overlay">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <Camera className="logo-icon" size={48} />
          <h1 className="auth-title">CrowdSense</h1>
          <p className="auth-subtitle">Security verification | Admin Console</p>
          
          <div className="auth-input-group">
            <label className="auth-label">Administrator Password</label>
            <input 
              className="auth-input"
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button className="auth-btn" type="submit">Authenticate</button>
          
          {authError && <div className="auth-error">{authError}</div>}
        </form>
      </div>
    );
  }

  // --- Render Dashboard App ---
  return (
    <div className="app-container">
      {/* Dashboard Sticky Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <Camera className="logo-icon" size={32} />
          <div>
            <h1 className="header-title">CrowdSense</h1>
            <p className="header-subtitle">Administrative Validation Center</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="main-content">
        {/* Navigation Tabs bar */}
        <div className="tabs-row">
          <button 
            className={`tab-btn ${activeTab === 'prioritized' ? 'active' : ''}`}
            onClick={() => setActiveTab('prioritized')}
            style={{ background: activeTab === 'prioritized' ? 'rgba(99, 102, 241, 0.25)' : undefined, borderColor: activeTab === 'prioritized' ? '#6366f1' : undefined }}
          >
            <Sparkles size={15} color="#818cf8" />
            AI Priority & Triage Queue ({prioritizedClusters.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={15} />
            Dashboard Stats
          </button>
          <button 
            className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <Table size={15} />
            Pending Verification ({stats.pending})
          </button>

          <button 
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <MapIcon size={15} />
            Live Cluster Map
          </button>
          <button 
            className={`tab-btn ${activeTab === 'flagged' ? 'active' : ''}`}
            onClick={() => setActiveTab('flagged')}
          >
            <ShieldAlert size={15} />
            Priority Flagged Queue ({flaggedSubmissions.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'safety' ? 'active' : ''}`}
            onClick={() => setActiveTab('safety')}
          >
            <ShieldAlert size={15} color="#E11D48" />
            Women&apos;s Safety Lane
          </button>
          <button 
            className={`tab-btn ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={async () => {
              setActiveTab('accessibility');
              try {
                const res = await fetch(`${API_BASE_URL}/exports/accessibility-audit?format=json`);
                if (res.ok) setAccessibilityAudits(await res.json());
              } catch (_) {}
            }}
          >
            <Users size={15} />
            Accessibility NGO Audits
          </button>
          <button 
            className={`tab-btn ${activeTab === 'utilities' ? 'active' : ''}`}
            onClick={async () => {
              setActiveTab('utilities');
              try {
                const res = await fetch(`${API_BASE_URL}/utilities/status`);
                if (res.ok) setUtilityStatusList(await res.json());
              } catch (_) {}
            }}
          >
            <Layers size={15} />
            Utility Outages Ward Status
          </button>
        </div>

        {/* LOADING INDICATOR */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <RefreshCw size={40} className="pulse" style={{ color: 'var(--accent-cyan)', animation: 'spin 2s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Syncing with CrowdSense FastAPI backend...</p>
          </div>
        ) : (
          <>
            {/* VIEW 0: AI PRIORITY & TRIAGE QUEUE */}
            {activeTab === 'prioritized' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))', borderRadius: '16px', padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 12px', borderRadius: '20px', color: '#818cf8', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                        <Sparkles size={14} /> Municipal Intelligence Engine
                      </div>
                      <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                        AI-Assisted Moderator Triage & Priority Queue
                      </h2>
                      <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '650px', lineHeight: 1.5 }}>
                        Automated multi-factor priority ranking paired with grounded 1-line triage summaries and statistical recurrence risk predictions to accelerate municipal intervention.
                      </p>
                    </div>

                    <button 
                      className="refresh-btn" 
                      onClick={fetchData}
                      style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                      <RefreshCw size={14} /> Sync Triage Queue
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Total Ranked Clusters</span>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>{prioritizedClusters.length}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>High Recurrence Risk</span>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#f43f5e', marginTop: '4px' }}>
                        {prioritizedClusters.filter(c => c.recurrence_risk?.is_high_risk).length}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Avg Priority Score</span>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                        {prioritizedClusters.length > 0 
                          ? (prioritizedClusters.reduce((acc, c) => acc + (c.priority_score || 0), 0) / prioritizedClusters.length).toFixed(2)
                          : '0.00'}
                      </div>
                    </div>
                  </div>
                </div>

                {prioritizedClusters.length === 0 ? (
                  <div className="table-card" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                    <CheckCircle size={48} style={{ color: 'var(--accent-emerald)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>Priority Queue Clear</h3>
                    <p>All active clusters are currently resolved or queued for processing.</p>
                  </div>
                ) : (
                  <div className="table-card">
                    <div className="submissions-table-container">
                      <table className="submissions-table">
                        <thead>
                          <tr>
                            <th>Rank & Score</th>
                            <th>Category</th>
                            <th style={{ minWidth: '280px' }}>AI Triage Summary</th>
                            <th>Recurrence Risk</th>
                            <th>Reports Volume</th>
                            <th>Location</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prioritizedClusters.map((cluster, index) => {
                            const score = cluster.priority_score || 0.5;
                            const risk = cluster.recurrence_risk || {};
                            const isHighRisk = risk.is_high_risk;
                            const isMedRisk = risk.risk_level === 'medium';

                            return (
                              <tr key={cluster.id || index}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ 
                                      background: index === 0 ? '#ef4444' : index <= 2 ? '#f59e0b' : '#3b82f6', 
                                      color: '#fff', 
                                      padding: '3px 8px', 
                                      borderRadius: '6px', 
                                      fontWeight: 800, 
                                      fontSize: '11px' 
                                    }}>
                                      #{index + 1}
                                    </span>
                                    <div>
                                      <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '13px' }}>{score.toFixed(2)}</div>
                                      <div style={{ width: '45px', height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                                        <div style={{ width: `${Math.min(100, score * 100)}%`, height: '100%', background: score >= 0.8 ? '#ef4444' : score >= 0.5 ? '#f59e0b' : '#10b981' }} />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="mission-pill" style={{ textTransform: 'capitalize' }}>
                                    {cluster.mission_type || 'pothole'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ 
                                    background: 'rgba(15, 23, 42, 0.7)', 
                                    padding: '10px 14px', 
                                    borderRadius: '10px', 
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: '#e2e8f0',
                                    fontSize: '12px',
                                    lineHeight: 1.45,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px'
                                  }}>
                                    <Sparkles size={14} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <span>{cluster.triage_summary || `${cluster.submission_count || 1} report(s) active in Indiranagar.`}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{
                                      background: isHighRisk ? 'rgba(239, 68, 68, 0.15)' : isMedRisk ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                      color: isHighRisk ? '#f87171' : isMedRisk ? '#fbbf24' : '#34d399',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontWeight: 800,
                                      fontSize: '11px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      width: 'fit-content'
                                    }}>
                                      {isHighRisk && <AlertTriangle size={11} />}
                                      {risk.recurrence_probability_pct ? `${risk.recurrence_probability_pct}% Risk` : 'Low Risk'}
                                    </span>
                                    {isHighRisk && (
                                      <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>
                                        ⚠️ Monitor closely
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                                    {cluster.submission_count || 1} reports
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {cluster.days_open ? `Open ~${Math.round(cluster.days_open)}d` : 'Active'}
                                  </div>
                                </td>
                                <td>
                                  <a 
                                    className="loc-link" 
                                    href={`https://www.google.com/maps/search/?api=1&query=${cluster.latitude || 12.9716},${cluster.longitude || 77.5946}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                  >
                                    <MapPin size={13} />
                                    {(cluster.latitude || 12.9716).toFixed(4)}, {(cluster.longitude || 77.5946).toFixed(4)}
                                  </a>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => handleResolveCluster(cluster)}
                                      style={{
                                        background: isHighRisk ? '#dc2626' : '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      <Check size={14} /> Resolve
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW A: DASHBOARD STATS */}
            {activeTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="stats-grid">
                  <div className="stat-card cyan">
                    <div className="stat-header">
                      <span className="stat-label">Total Submissions</span>
                      <div className="stat-icon-wrapper">
                        <Layers size={18} />
                      </div>
                    </div>
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-desc">Lifetime submissions reported</span>
                  </div>

                  <div className="stat-card emerald">
                    <div className="stat-header">
                      <span className="stat-label">Approval Rate</span>
                      <div className="stat-icon-wrapper">
                        <Percent size={18} />
                      </div>
                    </div>
                    <span className="stat-value">{stats.approvalRate.toFixed(1)}%</span>
                    <span className="stat-desc">Approved vs. Rejected (excluding pending)</span>
                  </div>

                  <div className="stat-card violet">
                    <div className="stat-header">
                      <span className="stat-label">Pending Verification</span>
                      <div className="stat-icon-wrapper">
                        <ShieldAlert size={18} />
                      </div>
                    </div>
                    <span className="stat-value">{stats.pending}</span>
                    <span className="stat-desc">Awaiting administrator review</span>
                  </div>

                  <div className="stat-card rose">
                    <div className="stat-header">
                      <span className="stat-label">Total Clusters</span>
                      <div className="stat-icon-wrapper">
                        <TrendingUp size={18} />
                      </div>
                    </div>
                    <span className="stat-value">{clusters.length}</span>
                    <span className="stat-desc">Spatiotemporal incident groupings</span>
                  </div>
                </div>

                <div className="charts-grid">
                  {/* Mission Type Chart */}
                  <div className="chart-card">
                    <h3 className="chart-title">
                      <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
                      Missions Distribution
                    </h3>
                    <div className="mission-bar-list">
                      {['pothole', 'garbage', 'noise', 'accessibility', 'infrastructure'].map((type) => {
                        const count = stats.missionCounts[type] || 0;
                        const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                        return (
                          <div key={type} className="mission-row">
                            <div className="mission-row-header">
                              <span className="mission-label">{type}</span>
                              <span className="mission-count">{count} reports ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Flagged Devices */}
                  <div className="chart-card">
                    <h3 className="chart-title">
                      <Users size={18} style={{ color: 'var(--accent-rose)' }} />
                      Top Flagged Devices (Anomalies)
                    </h3>
                    <div className="top-devices-list">
                      {stats.topFlaggedDevices.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No device anomalies flagged yet.
                        </div>
                      ) : (
                        stats.topFlaggedDevices.map((dev) => (
                          <div key={dev.id} className="top-device-row">
                            <div className="device-info">
                              <span className="device-id">{dev.id.slice(0, 16)}...</span>
                              <span className="device-trust">Reputation Trust Score: {Math.round(dev.trust * 100)}%</span>
                            </div>
                            <div className="device-flags-count">
                              <AlertTriangle size={13} />
                              {dev.count} flags
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: PENDING VERIFICATION TABLE */}
            {activeTab === 'table' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Filters toolbar */}
                <div className="control-bar">
                  <div className="filters-group">
                    <select 
                      className="filter-select"
                      value={filterMission}
                      onChange={(e) => setFilterMission(e.target.value)}
                    >
                      <option value="all">All Mission Types</option>
                      <option value="pothole">Pothole</option>
                      <option value="garbage">Garbage</option>
                      <option value="noise">Noise</option>
                      <option value="accessibility">Accessibility</option>
                      <option value="infrastructure">Infrastructure</option>
                    </select>

                    <select 
                      className="filter-select"
                      value={filterFlags}
                      onChange={(e) => setFilterFlags(e.target.value)}
                    >
                      <option value="all">All Verification Statuses</option>
                      <option value="flagged">Flagged Only</option>
                      <option value="clean">Clean (No Flags)</option>
                    </select>
                  </div>

                  <button className="refresh-btn" onClick={fetchData}>
                    <RefreshCw size={13} />
                    Sync
                  </button>
                </div>

                {/* Submissions Table display */}
                {filteredSubmissions.length === 0 ? (
                  <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
                    <CheckCircle size={48} style={{ color: 'var(--accent-emerald)' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Verification Queue Empty</h3>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px' }}>
                      There are no submissions waiting for review matching the active filter selections.
                    </p>
                  </div>
                ) : (
                  <div className="table-card">
                    <div className="submissions-table-container">
                      <table className="submissions-table">
                        <thead>
                          <tr>
                            <th>Photo</th>
                            <th>Mission</th>
                            <th onClick={() => toggleSort('captured_at')} style={{ cursor: 'pointer' }}>
                              Captured At {sortKey === 'captured_at' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th onClick={() => toggleSort('trust_score')} style={{ cursor: 'pointer' }}>
                              Trust Score {sortKey === 'trust_score' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th>Tier 0 Flags</th>
                            <th>Location</th>
                            <th>Notes</th>
                            <th>Decision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubmissions.map((sub) => {
                            const trust = deviceTrustScores[sub.device_id] !== undefined 
                              ? deviceTrustScores[sub.device_id] 
                              : 0.5;
                            const isHighTrust = trust >= 0.75;
                            const isLowTrust = trust <= 0.4;
                            const hasFlags = sub.flags && sub.flags.length > 0;

                            return (
                              <tr key={sub.id}>
                                <td>
                                  <div 
                                    className="photo-thumbnail-container"
                                    onClick={() => !sub.flags?.includes('auto_rejected_content_policy') && setSelectedImage(sub.photo_url)}
                                  >
                                    {sub.flags?.includes('auto_rejected_content_policy') ? (
                                      <div className="violation-thumbnail">Violated Guidelines</div>
                                    ) : (
                                      <img className="photo-thumbnail" src={sub.photo_url} alt="Incident" />
                                    )}
                                  </div>
                                </td>
                                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{sub.mission_type}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                  {new Date(sub.captured_at).toLocaleString()}
                                </td>
                                <td>
                                  <span style={{
                                    background: isHighTrust ? 'rgba(16, 185, 129, 0.15)' : isLowTrust ? 'rgba(244, 63, 94, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                                    color: isHighTrust ? 'var(--accent-emerald)' : isLowTrust ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '11px'
                                  }}>
                                    {Math.round(trust * 100)}%
                                  </span>
                                </td>
                                <td>
                                  {hasFlags ? (
                                    <div className="flags-list">
                                      {sub.flags?.map((f) => {
                                        const c = f === 'EXIF_TIMESTAMP_MISMATCH' ? 'exif' : '';
                                        return (
                                          <span key={f} className={`flag-badge ${c}`}>
                                            <AlertTriangle size={10} />
                                            {f.replace(/_/g, ' ')}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="no-flags">
                                      <Check size={14} />
                                      Clean
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <a 
                                    className="loc-link" 
                                    href={`https://www.google.com/maps/search/?api=1&query=${sub.latitude},${sub.longitude}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                  >
                                    <MapPin size={13} />
                                    {sub.latitude.toFixed(4)}, {sub.longitude.toFixed(4)}
                                  </a>
                                  <span className="loc-device">Device: {sub.device_id.slice(0, 12)}...</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                  {sub.notes || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None</span>}
                                </td>
                                <td>
                                  <div className="actions-cell">
                                    <button 
                                      className="action-icon-btn approve" 
                                      title="Approve Report"
                                      disabled={processingId === sub.id}
                                      onClick={() => handleDecision(sub.id, 'approved')}
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button 
                                      className="action-icon-btn reject" 
                                      title="Reject Report"
                                      disabled={processingId === sub.id}
                                      onClick={() => handleDecision(sub.id, 'rejected')}
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: LIVE CLUSTERS MAP */}
            {activeTab === 'map' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Incident map grouping reports spatiotemporally within 20m and 72 hours.
                  </p>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-rose)' }}></span>
                      Active
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }}></span>
                      Resolved
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }}></span>
                      Stale
                    </span>
                  </div>
                </div>
                <div className="map-view-wrapper">
                  <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
            )}

            {/* VIEW D: PRIORITY FLAGGED QUEUE & USER BAN */}
            {activeTab === 'flagged' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px' }}>
                    Ban / Suspend Account by User or Phone Hash
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Phone Hash or User ID..."
                      value={banInput.phoneHash}
                      onChange={(e) => setBanInput({ ...banInput, phoneHash: e.target.value })}
                      style={{ background: '#0f172a', border: '1px solid #475569', color: '#fff', borderRadius: '8px', padding: '10px 14px', flex: '1', minWidth: '240px' }}
                    />
                    <input 
                      type="text" 
                      placeholder="Suspension reason..."
                      value={banInput.reason}
                      onChange={(e) => setBanInput({ ...banInput, reason: e.target.value })}
                      style={{ background: '#0f172a', border: '1px solid #475569', color: '#fff', borderRadius: '8px', padding: '10px 14px', flex: '2', minWidth: '300px' }}
                    />
                    <button
                      onClick={async () => {
                        if (!banInput.phoneHash || !banInput.reason) {
                          alert('Please enter phone hash / user ID and suspension reason.');
                          return;
                        }
                        try {
                          const res = await fetch(`${API_BASE_URL}/admin/users/ban`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone_hash: banInput.phoneHash, reason: banInput.reason }),
                          });
                          if (res.ok) {
                            alert('User account successfully suspended/banned.');
                            setBanInput({ phoneHash: '', reason: '' });
                          } else {
                            alert('Ban request failed.');
                          }
                        } catch (err: any) {
                          alert(`Ban failed: ${err.message}`);
                        }
                      }}
                      style={{ background: '#ef4444', color: '#fff', fontWeight: 'bold', borderRadius: '8px', padding: '10px 20px', border: 'none', cursor: 'pointer' }}
                    >
                      Suspend User
                    </button>
                  </div>
                </div>

                <div className="table-wrapper">
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>
                      Community Flagged Submissions ({flaggedSubmissions.length})
                    </h3>
                  </div>

                  {flaggedSubmissions.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No pending community flags. All submissions are clean!
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Reported ID</th>
                          <th>Category</th>
                          <th>Flag Reason</th>
                          <th>Reported At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flaggedSubmissions.map((item) => (
                          <tr key={item.id}>
                            <td>{item.submission_id ? item.submission_id.slice(0, 8) : item.id.slice(0, 8)}...</td>
                            <td><span className="mission-pill">{item.mission_type || 'Civic Report'}</span></td>
                            <td><span style={{ color: '#f87171', fontWeight: 'bold' }}>{item.reason}</span></td>
                            <td>{new Date(item.created_at).toLocaleString()}</td>
                            <td>
                              <button
                                style={{ background: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                onClick={() => handleDecision(item.submission_id || item.id, 'rejected')}
                              >
                                Reject & Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* VIEW E: WOMEN'S SAFETY LANE */}
            {activeTab === 'safety' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#881337', borderRadius: '12px', padding: '20px', border: '1px solid #f43f5e' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                    Women&apos;s Safety Priority Dispatch Queue
                  </h3>
                  <p style={{ fontSize: '13px', color: '#fecdd3', margin: 0 }}>
                    Directly routed to Municipal Safety & Street Lighting Departments. Reporter identities are strictly anonymized.
                  </p>
                </div>

                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Incident ID</th>
                        <th>Safety Sub-type</th>
                        <th>Reporter Privacy</th>
                        <th>Location Coordinates</th>
                        <th>Submitted At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.filter(s => s.mission_type === 'safety_concern').map((item) => (
                        <tr key={item.id}>
                          <td>{item.id.slice(0, 8)}...</td>
                          <td><span style={{ backgroundColor: '#ffe4e6', color: '#e11d48', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px' }}>Safety Concern</span></td>
                          <td><span style={{ color: '#10b981', fontWeight: 'bold' }}>ANONYMOUS</span></td>
                          <td>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</td>
                          <td>{new Date(item.submitted_at).toLocaleString()}</td>
                          <td>
                            <button
                              style={{ background: '#10b981', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                              onClick={() => handleDecision(item.id, 'approved')}
                            >
                              Dispatch Patrol / Lighting Crew
                            </button>
                          </td>
                        </tr>
                      ))}
                      {submissions.filter(s => s.mission_type === 'safety_concern').length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                            No active safety concern reports requiring priority dispatch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW F: ACCESSIBILITY NGO AUDITS */}
            {activeTab === 'accessibility' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                      Structured Accessibility Audits Data Product
                    </h3>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                      Clean export endpoint for NGO and CSR disability rights partners.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <a
                      href={`${API_BASE_URL}/exports/accessibility-audit?format=csv`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      Export CSV
                    </a>
                    <a
                      href={`${API_BASE_URL}/exports/accessibility-audit?format=json`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#0284c7', color: '#fff', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      Export JSON
                    </a>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Audit ID</th>
                        <th>Location Type</th>
                        <th>Issue Type</th>
                        <th>Severity</th>
                        <th>Recorded At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessibilityAudits.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>{item.id ? item.id.slice(0, 8) : `audit_${idx + 1}`}</td>
                          <td><span className="mission-pill">{item.location_type || 'public_building'}</span></td>
                          <td><span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{item.issue_type || 'missing_ramp'}</span></td>
                          <td><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.severity || 'blocks_access_entirely'}</span></td>
                          <td>{new Date(item.created_at || Date.now()).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {accessibilityAudits.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                            No accessibility audits recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW G: UTILITY OUTAGES WARD DASHBOARD */}
            {activeTab === 'utilities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                    Live Utility Outages Ward Status
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    Zone-level water supply and power disruption monitoring. Auto-expires after 3 hours unless re-confirmed.
                  </p>
                </div>

                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Ward Identifier</th>
                        <th>Utility Type</th>
                        <th>Current Disruption Status</th>
                        <th>Last Reported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilityStatusList.map((item, idx) => (
                        <tr key={idx}>
                          <td><b>{item.ward_name || item.ward_id || 'Ward 12 - Indiranagar'}</b></td>
                          <td><span className="mission-pill">{item.utility_type || 'water'}</span></td>
                          <td><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.status || 'outage'}</span></td>
                          <td>{new Date(item.last_updated || Date.now()).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                      {utilityStatusList.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                            All utility supply lines operating normally across wards.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Enlarged Photo Lightbox Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content-container" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedImage(null)}>
              <X size={18} />
              Close
            </button>
            <img className="modal-img" src={selectedImage} alt="Incident Zoomed" />
          </div>
        </div>
      )}

      {/* Recurrence Risk Warning Nudge Modal */}
      {recurrenceModalData && (
        <div className="modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
          <div 
            className="modal-content-container" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', background: '#0f172a', border: '1px solid #dc2626', borderRadius: '16px', padding: '28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '12px', color: '#ef4444' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                  Monitor This One — High Recurrence Risk
                </h3>
                <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 700 }}>
                  Estimated {recurrenceModalData.riskData.recurrence_probability_pct}% probability of reopening
                </span>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5, marginBottom: '18px' }}>
              Our predictive civic stability model flagged this cluster as prone to repeat failures based on environmental and structural indicators.
            </p>

            {recurrenceModalData.riskData.risk_factors?.length > 0 && (
              <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
                  Key Risk Factors Detected:
                </span>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#fca5a5', fontSize: '12px', lineHeight: 1.6 }}>
                  {recurrenceModalData.riskData.risk_factors.map((f: string, idx: number) => (
                    <li key={idx}><b>{f}</b></li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRecurrenceModalData(null)}
                style={{
                  background: '#334155',
                  color: '#e2e8f0',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Keep Open & Monitor
              </button>
              <button
                onClick={() => executeClusterResolution(recurrenceModalData.cluster.id)}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Mark Resolved Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

