'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface AdminComment {
  id: string;
  cluster_id: string;
  author_name: string;
  body: string;
  is_anonymous: boolean;
  is_flagged: boolean;
  flag_count: number;
  upvotes: number;
  status: 'ACTIVE' | 'FLAGGED' | 'HIDDEN' | 'REMOVED';
  pii_redacted?: boolean;
  created_at: string;
}

const INITIAL_COMMENTS: AdminComment[] = [
  {
    id: 'comm-101',
    cluster_id: 'cluster-blr-101',
    author_name: 'Suresh Patil',
    body: 'Waterlogging receded after the storm drain desilting this morning. Pothole remains visible.',
    is_anonymous: false,
    is_flagged: false,
    flag_count: 0,
    upvotes: 14,
    status: 'ACTIVE',
    pii_redacted: false,
    created_at: '2026-10-21T09:30:00Z',
  },
  {
    id: 'comm-102',
    cluster_id: 'cluster-blr-101',
    author_name: 'Civic Resident',
    body: 'Please contact contractor at [PHONE REDACTED] regarding loose asphalt boulders on right lane.',
    is_anonymous: false,
    is_flagged: false,
    flag_count: 0,
    upvotes: 5,
    status: 'ACTIVE',
    pii_redacted: true,
    created_at: '2026-10-21T10:15:00Z',
  },
  {
    id: 'comm-103',
    cluster_id: 'cluster-blr-102',
    author_name: 'Anonymous Resident',
    body: 'Check out cheap loans and crypto investment www.fake-spam-link.io right now!',
    is_anonymous: true,
    is_flagged: true,
    flag_count: 4,
    upvotes: 0,
    status: 'HIDDEN',
    pii_redacted: false,
    created_at: '2026-10-21T11:00:00Z',
  },
  {
    id: 'comm-104',
    cluster_id: 'cluster-blr-safety-1',
    author_name: 'Anonymous Resident',
    body: 'Streetlight pole #42 wires are dangling into pedestrian walkway after the tree fall.',
    is_anonymous: true,
    is_flagged: false,
    flag_count: 0,
    upvotes: 22,
    status: 'ACTIVE',
    pii_redacted: false,
    created_at: '2026-10-21T11:45:00Z',
  },
  {
    id: 'comm-105',
    cluster_id: 'cluster-blr-102',
    author_name: 'Angry Commuter',
    body: 'Total idiots in charge of this ward road work!!',
    is_anonymous: false,
    is_flagged: true,
    flag_count: 2,
    upvotes: 1,
    status: 'FLAGGED',
    pii_redacted: false,
    created_at: '2026-10-21T12:05:00Z',
  },
];

export default function CommentsAdminPage() {
  const [comments, setComments] = useState<AdminComment[]>(INITIAL_COMMENTS);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'FLAGGED' | 'HIDDEN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const updateStatus = async (clusterId: string, commentId: string, newStatus: AdminComment['status']) => {
    try {
      await fetch(`${API_BASE}/api/v1/comments/${clusterId}/${commentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // ignore network errors for demo
    }

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status: newStatus } : c))
    );
    showToast(`Comment marked as ${newStatus}`);
  };

  const filteredComments = comments.filter((c) => {
    if (filter !== 'ALL' && c.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.body.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.cluster_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCount = comments.length;
  const piiRedactedCount = comments.filter((c) => c.pii_redacted).length;
  const flaggedCount = comments.filter((c) => c.status === 'FLAGGED').length;
  const hiddenCount = comments.filter((c) => c.status === 'HIDDEN').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Breadcrumb & Title */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/" className="hover:text-indigo-400 transition">
              ← Main Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-200">Community Moderation</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>💬</span> Resident Comments & Discussion Moderation
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Grounded hyper-local dialogue with automated PII redaction and community peer-flagging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/repair-costs"
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold border border-slate-700 transition"
          >
            Repair Cost Bids
          </Link>
          <Link
            href="/assets"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
          >
            Civic Asset Tags →
          </Link>
        </div>
      </div>

      {toastMsg && (
        <div className="max-w-7xl mx-auto mb-6 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm flex items-center gap-2">
          <span>✓</span> {toastMsg}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Comments</div>
          <div className="text-2xl font-black text-white mt-2">{totalCount}</div>
          <div className="text-slate-500 text-xs mt-1">Across all verified defect clusters</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">PII Auto-Masked</div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{piiRedactedCount}</div>
          <div className="text-slate-500 text-xs mt-1">Phones & emails redacted automatically</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Under Review (Flagged)</div>
          <div className="text-2xl font-black text-amber-400 mt-2">{flaggedCount}</div>
          <div className="text-slate-500 text-xs mt-1">Awaiting moderator validation</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hidden / Filtered</div>
          <div className="text-2xl font-black text-rose-400 mt-2">{hiddenCount}</div>
          <div className="text-slate-500 text-xs mt-1">Exceeded 3+ community flags</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-7xl mx-auto bg-slate-900/80 border border-slate-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {(['ALL', 'ACTIVE', 'FLAGGED', 'HIDDEN'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                filter === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by comment text, author, or cluster ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-80 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Comments Moderation Table */}
      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Author & Timestamp</th>
                <th className="p-4">Cluster ID</th>
                <th className="p-4">Comment Text</th>
                <th className="p-4">Community Signals</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Moderator Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredComments.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition">
                  <td className="p-4 whitespace-nowrap">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      {c.author_name}
                      {c.is_anonymous && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-normal">
                          Anon
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>

                  <td className="p-4 whitespace-nowrap font-mono text-indigo-400">
                    {c.cluster_id}
                  </td>

                  <td className="p-4 max-w-md">
                    <p className="line-clamp-2 text-slate-200">{c.body}</p>
                    {c.pii_redacted && (
                      <span className="inline-block mt-1 text-[10px] text-emerald-400 font-semibold">
                        🔒 PII Redacted
                      </span>
                    )}
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        👍 {c.upvotes}
                      </span>
                      {c.flag_count > 0 && (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          🚩 {c.flag_count}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : c.status === 'FLAGGED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="p-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.status !== 'ACTIVE' && (
                        <button
                          onClick={() => updateStatus(c.cluster_id, c.id, 'ACTIVE')}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded font-semibold text-[11px] transition"
                        >
                          Approve
                        </button>
                      )}
                      {c.status !== 'HIDDEN' && (
                        <button
                          onClick={() => updateStatus(c.cluster_id, c.id, 'HIDDEN')}
                          className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded font-semibold text-[11px] transition"
                        >
                          Hide
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(c.cluster_id, c.id, 'REMOVED')}
                        className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded font-semibold text-[11px] transition"
                      >
                        Remove
                      </button>
                    </div>
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
