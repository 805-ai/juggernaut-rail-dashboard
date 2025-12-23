// Receipt Dashboard Types

export interface Receipt {
  id: string;
  receiptHash: string;
  payload: Record<string, unknown>;
  timestamp: number;
  edVerified: boolean;
  ecVerified: boolean;
  hashVerified: boolean;
  txHash?: string;
  blockNumber?: number;
  createdAt: string;
}

export interface Metrics {
  total: number;
  lastHour: number;
  lastDay: number;
  verified: number;
  anchored: number;
  verificationRate: string;
  anchoringRate: string;
  throughput: {
    hourly: number;
    daily: number;
    avgPerMinute: string;
  };
}

export interface ThroughputPoint {
  hour: string;
  count: number;
}

export interface ChainStatus {
  anchored: number;
  pending: number;
  unanchored: number;
  latestBlock?: {
    blockNumber: number;
    txHash: string;
  };
}

export interface PaginatedResponse<T> {
  receipts: T[];
  pagination: {
    page: number;
    pages: number;
    total: number;
  };
}

export type FilterType = 'all' | 'verified' | 'pending' | 'anchored';
