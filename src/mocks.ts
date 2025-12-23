// Mock data for development/demo mode
import type { Receipt, Metrics, ThroughputPoint, ChainStatus } from './types';

const randomHex = (length: number): string =>
  Array.from({ length }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

export const MOCK_METRICS: Metrics = {
  total: 1847,
  lastHour: 23,
  lastDay: 412,
  verified: 1839,
  anchored: 1847,
  verificationRate: '99.57',
  anchoringRate: '100.00',
  throughput: { hourly: 23, daily: 412, avgPerMinute: '0.38' }
};

export const MOCK_RECEIPTS: Receipt[] = Array.from({ length: 50 }, (_, i) => ({
  id: `rec_${1000 - i}`,
  receiptHash: randomHex(64),
  payload: {
    id: `selfie_${1000 - i}.jpg`,
    patientId: 100 + i,
    nurse: ['Alice', 'Bob', 'Carol'][i % 3]
  },
  timestamp: Date.now() - i * 180000,
  edVerified: Math.random() > 0.02,
  ecVerified: Math.random() > 0.02,
  hashVerified: true,
  txHash: `0x${randomHex(64)}`,
  blockNumber: 1000 - i,
  createdAt: new Date(Date.now() - i * 180000).toISOString()
}));

export const MOCK_THROUGHPUT: ThroughputPoint[] = Array.from({ length: 24 }, (_, i) => ({
  hour: new Date(Date.now() - (23 - i) * 3600000).toISOString().slice(11, 13) + ':00',
  count: Math.floor(Math.random() * 30) + 10
}));

export const MOCK_CHAIN: ChainStatus = {
  anchored: 1847,
  pending: 0,
  unanchored: 0,
  latestBlock: { blockNumber: 1000, txHash: '0xabc...def' }
};
