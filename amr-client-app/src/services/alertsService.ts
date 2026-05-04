import { apiRequest } from './api/client';

export type AlertSignal = {
  id: string;
  title: string;
  locationLabel?: string | null;
  time: string;
};

type AlertsResponse = {
  alerts: AlertSignal[];
};

const fallbackAlerts: AlertSignal[] = [
  {
    id: 'a-1',
    title: 'Red zone threshold crossed in Delhi CRE cluster',
    time: '3 min ago',
  },
  {
    id: 'a-2',
    title: 'Prescription anomaly detected for carbapenems',
    time: '15 min ago',
  },
  {
    id: 'a-3',
    title: 'Community respiratory cluster reported in Bengaluru',
    time: '29 min ago',
  },
];

export async function getAlerts(): Promise<AlertSignal[]> {
  try {
    const response = await apiRequest<AlertsResponse>('/api/alerts');
    return response.alerts;
  } catch {
    return fallbackAlerts;
  }
}
