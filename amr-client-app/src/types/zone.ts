export type ZoneSeverity = 'amber' | 'red';

export type Zone = {
  id: string;
  label: string;
  locationLabel?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  severity: ZoneSeverity;
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};
