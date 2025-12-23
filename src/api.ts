// API client for Juggernaut Rail
import type { Metrics, Receipt, ThroughputPoint, ChainStatus, PaginatedResponse, FilterType } from './types';
import { MOCK_METRICS, MOCK_RECEIPTS, MOCK_THROUGHPUT, MOCK_CHAIN } from './mocks';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new ApiError(`API error: ${response.statusText}`, response.status);
  }

  return response.json();
}

export async function getMetrics(): Promise<Metrics> {
  if (USE_MOCK) return MOCK_METRICS;
  return fetchApi<Metrics>('/metrics');
}

export async function getReceipts(
  page: number = 1,
  limit: number = 10,
  filter: FilterType = 'all'
): Promise<PaginatedResponse<Receipt>> {
  if (USE_MOCK) {
    const filtered = filter === 'all'
      ? MOCK_RECEIPTS
      : MOCK_RECEIPTS.filter(r => {
          if (filter === 'verified') return r.edVerified && r.ecVerified;
          if (filter === 'pending') return !r.txHash;
          if (filter === 'anchored') return !!r.txHash;
          return true;
        });

    const start = (page - 1) * limit;
    const receipts = filtered.slice(start, start + limit);

    return {
      receipts,
      pagination: {
        page,
        pages: Math.ceil(filtered.length / limit),
        total: filtered.length,
      },
    };
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filter !== 'all') params.set('status', filter);

  return fetchApi<PaginatedResponse<Receipt>>(`/receipts?${params}`);
}

export async function getThroughput(hours: number = 24): Promise<ThroughputPoint[]> {
  if (USE_MOCK) return MOCK_THROUGHPUT;
  return fetchApi<ThroughputPoint[]>(`/analytics/throughput?hours=${hours}`);
}

export async function getChainStatus(): Promise<ChainStatus> {
  if (USE_MOCK) return MOCK_CHAIN;
  return fetchApi<ChainStatus>('/analytics/chain');
}

export async function fetchAllData(page: number, filter: FilterType) {
  const [metrics, receiptsData, throughput, chainStatus] = await Promise.all([
    getMetrics(),
    getReceipts(page, 10, filter),
    getThroughput(24),
    getChainStatus(),
  ]);

  return {
    metrics,
    receipts: receiptsData.receipts,
    totalPages: receiptsData.pagination.pages,
    throughput,
    chainStatus,
  };
}

export { ApiError, USE_MOCK };
