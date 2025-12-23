import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Shield, CheckCircle, XCircle, Clock, Database, Link2,
  RefreshCw, Search, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';

import type { Receipt, Metrics, ThroughputPoint, ChainStatus, FilterType } from './types';
import { fetchAllData, USE_MOCK, ApiError } from './api';
import { useDebounce, useKeydown, formatTime, truncateHash } from './hooks';

// ============================================================================
// Sub-components
// ============================================================================

interface StatusBadgeProps {
  verified: boolean;
  label: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ verified, label }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
    verified ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
  }`}>
    {verified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {label}
  </span>
);

interface MetricCardProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  subvalue?: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, label, value, subvalue, color }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-zinc-400 text-sm">{label}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
        {subvalue && <p className="text-xs text-zinc-500">{subvalue}</p>}
      </div>
    </div>
  </div>
);

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => (
  <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-red-400" />
      <p className="text-red-300">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded text-sm font-medium transition"
    >
      Retry
    </button>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <tr>
    <td colSpan={5} className="text-center py-12 text-zinc-500">
      <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
      {message}
    </td>
  </tr>
);

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
  </div>
);

interface ReceiptModalProps {
  receipt: Receipt;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  useKeydown('Escape', onClose);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 id="modal-title" className="font-medium">Receipt Details</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl p-1"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Receipt Hash</p>
            <p className="font-mono text-sm bg-zinc-800 p-2 rounded break-all select-all">
              {receipt.receiptHash}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Ed25519</p>
              <StatusBadge verified={receipt.edVerified} label={receipt.edVerified ? 'Verified' : 'Failed'} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">ECDSA</p>
              <StatusBadge verified={receipt.ecVerified} label={receipt.ecVerified ? 'Verified' : 'Failed'} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Hash</p>
              <StatusBadge verified={receipt.hashVerified} label={receipt.hashVerified ? 'Valid' : 'Invalid'} />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Payload</p>
            <pre className="font-mono text-xs bg-zinc-800 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(receipt.payload, null, 2)}
            </pre>
          </div>
          {receipt.txHash && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Chain Anchor</p>
              <div className="bg-zinc-800 p-2 rounded">
                <p className="font-mono text-xs break-all select-all">{receipt.txHash}</p>
                <p className="text-xs text-zinc-400 mt-1">Block #{receipt.blockNumber}</p>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500 mb-1">Timestamp</p>
            <p className="text-sm">{new Date(receipt.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Dashboard
// ============================================================================

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [throughput, setThroughput] = useState<ThroughputPoint[]>([]);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchInput, setSearchInput] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Debounce search to avoid excessive filtering
  const search = useDebounce(searchInput, 300);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAllData(page, filter);
      setMetrics(data.metrics);
      setReceipts(data.receipts);
      setTotalPages(data.totalPages);
      setThroughput(data.throughput);
      setChainStatus(data.chainStatus);
    } catch (e) {
      const message = e instanceof ApiError
        ? `API Error (${e.status}): ${e.message}`
        : 'Failed to fetch data';
      setError(message);
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter receipts client-side by search
  const filteredReceipts = receipts.filter(r => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      r.receiptHash.toLowerCase().includes(searchLower) ||
      r.txHash?.toLowerCase().includes(searchLower) ||
      JSON.stringify(r.payload).toLowerCase().includes(searchLower)
    );
  });

  // Reset page when filter changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Receipt Dashboard</h1>
            <p className="text-zinc-400 text-sm">
              Dual-signature verification system • Ed25519 + secp256k1/ECDSA
            </p>
          </div>
          <div className="flex items-center gap-3">
            {USE_MOCK && (
              <span className="px-3 py-1.5 rounded text-xs font-medium bg-amber-900/50 text-amber-400">
                Demo Mode
              </span>
            )}
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
              aria-label="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && <ErrorBanner message={error} onRetry={fetchData} />}

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Database}
              label="Total Receipts"
              value={metrics.total.toLocaleString()}
              subvalue={`+${metrics.lastHour} last hour`}
              color="bg-blue-900/50 text-blue-400"
            />
            <MetricCard
              icon={Shield}
              label="Verified"
              value={`${metrics.verificationRate}%`}
              subvalue={`${metrics.verified.toLocaleString()} receipts`}
              color="bg-emerald-900/50 text-emerald-400"
            />
            <MetricCard
              icon={Link2}
              label="Anchored"
              value={`${metrics.anchoringRate}%`}
              subvalue={`${metrics.anchored.toLocaleString()} on-chain`}
              color="bg-violet-900/50 text-violet-400"
            />
            <MetricCard
              icon={Clock}
              label="Throughput"
              value={`${metrics.throughput.avgPerMinute}/min`}
              subvalue={`${metrics.lastDay} last 24h`}
              color="bg-amber-900/50 text-amber-400"
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">24-Hour Throughput</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Chain Anchoring</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Anchored', value: chainStatus?.anchored || 0 },
                    { name: 'Pending', value: chainStatus?.pending || 0 },
                    { name: 'Unanchored', value: chainStatus?.unanchored || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Anchored
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Failed
              </span>
            </div>
            {chainStatus?.latestBlock && (
              <p className="text-center text-xs text-zinc-500 mt-3">
                Latest: Block #{chainStatus.latestBlock.blockNumber}
              </p>
            )}
          </div>
        </div>

        {/* Receipts Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Receipts</h3>
              <select
                value={filter}
                onChange={e => handleFilterChange(e.target.value as FilterType)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="anchored">Anchored</option>
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search hash, tx, payload..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded pl-9 pr-3 py-1.5 text-sm w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-400">Receipt Hash</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-400">Payload</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-400">Signatures</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-400">Chain</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredReceipts.length === 0 ? (
                  <EmptyState message={search ? 'No receipts match your search' : 'No receipts found'} />
                ) : (
                  filteredReceipts.map(r => (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-800/30 cursor-pointer"
                      onClick={() => setSelectedReceipt(r)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {truncateHash(r.receiptHash, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-300">
                          {(r.payload as Record<string, unknown>)?.nurse as string || '—'}
                        </span>
                        <span className="text-zinc-500 ml-2">
                          #{(r.payload as Record<string, unknown>)?.patientId as number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <StatusBadge verified={r.edVerified} label="Ed" />
                          <StatusBadge verified={r.ecVerified} label="EC" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.txHash ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle className="w-3 h-3" /> #{r.blockNumber}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {formatTime(r.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Receipt Detail Modal */}
        {selectedReceipt && (
          <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-zinc-600 pt-4">
          Final Boss Technologies • Dual-Signature Receipt System • PQC upgrade path available
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
