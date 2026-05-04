import { apiRequest } from './api/client';

export type DashboardSummary = {
  totals: {
    salesToday: number;
    prescriptionsToday: number;
    diseasesSeenToday: number;
    alertsToday: number;
  };
  topDiseases: Array<{ name: string; count: number }>;
  topProducts: Array<{ name: string; count: number }>;
  source: string;
};

export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskMapPoint = {
  pincode: string;
  locationLabel?: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  riskLevel: RiskLevel;
};

const fallbackSummary: DashboardSummary = {
  totals: {
    salesToday: 0,
    prescriptionsToday: 0,
    diseasesSeenToday: 0,
    alertsToday: 0,
  },
  topDiseases: [],
  topProducts: [],
  source: 'fallback',
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    return await apiRequest<DashboardSummary>('/api/dashboard/summary');
  } catch {
    return fallbackSummary;
  }
}

export async function getRiskMapPoints(): Promise<{
  points: RiskMapPoint[];
  source: string;
}> {
  try {
    return await apiRequest<{ points: RiskMapPoint[]; source: string }>(
      '/api/dashboard/risk-map',
    );
  } catch {
    return { points: [], source: 'fallback' };
  }
}
