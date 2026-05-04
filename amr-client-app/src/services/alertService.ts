import { apiRequest } from './api/client';

type EscalationPayload = {
  message: string;
  zoneId: string;
  zoneLabel: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
};

export async function notifyEscalation(payload: EscalationPayload) {
  await apiRequest('/api/escalations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
