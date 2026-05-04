import { apiRequest } from './api/client';

export type CommunitySignal = {
  id: string;
  area: string;
  symptoms: string;
  intensity: 'Low' | 'Medium' | 'High';
  reportedAt: string;
};

const fallbackSignals: CommunitySignal[] = [
  {
    id: '1',
    area: 'Delhi - 110001',
    symptoms: 'Persistent fever and non-responsive UTI',
    intensity: 'High',
    reportedAt: '5 min ago',
  },
  {
    id: '2',
    area: 'Mumbai - 400001',
    symptoms: 'Skin infection not improving after common antibiotics',
    intensity: 'Medium',
    reportedAt: '18 min ago',
  },
  {
    id: '3',
    area: 'Bengaluru - 560001',
    symptoms: 'Respiratory cases with delayed recovery',
    intensity: 'Low',
    reportedAt: '42 min ago',
  },
];

type CommunityResponse = {
  signals: CommunitySignal[];
};

export async function getCommunitySignals(): Promise<CommunitySignal[]> {
  try {
    const response = await apiRequest<CommunityResponse>(
      '/api/community-signals',
    );
    return response.signals;
  } catch {
    return fallbackSignals;
  }
}
