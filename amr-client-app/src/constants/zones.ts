import { Zone } from '../types/zone';

export const RED_ZONES: Zone[] = [
  {
    id: 'delhi-cre-1',
    label: 'Delhi CRE cluster',
    latitude: 28.6139,
    longitude: 77.209,
    radiusMeters: 1500,
    severity: 'red',
  },
  {
    id: 'mumbai-mrsa-1',
    label: 'Mumbai MRSA hotspot',
    latitude: 19.076,
    longitude: 72.8777,
    radiusMeters: 1400,
    severity: 'red',
  },
  {
    id: 'bengaluru-watch-1',
    label: 'Bengaluru watch zone',
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 1200,
    severity: 'amber',
  },
];
