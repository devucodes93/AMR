const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_BASE_URL is not configured",
      "api_base_url_missing",
    );
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const json = await parseJsonSafe(response);

  if (!response.ok) {
    const payload = json as { error?: string; code?: string } | null;
    throw new ApiError(payload?.error ?? "Request failed", payload?.code);
  }

  return json as T;
}

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

export type DashboardTrendPoint = {
  bucketStart: string;
  sales: number;
  prescriptions: number;
  alerts: number;
  signals: number;
  total: number;
};

export type DashboardTrend = {
  points: DashboardTrendPoint[];
  windowHours: number;
  bucketHours: number;
  source: string;
};

export type CommunitySignal = {
  id: string;
  area: string;
  symptoms: string;
  intensity: "Low" | "Medium" | "High";
  reportedAt: string;
};

export type AlertSignal = {
  id: string;
  title: string;
  locationLabel?: string | null;
  time: string;
};

export type RiskMapPoint = {
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
  riskLevel: "low" | "medium" | "high";
};

export type AuthResponse = {
  user: { id: string; email?: string } | null;
  session: { access_token: string; refresh_token: string } | null;
  role: "doctor" | "pharmacy" | "medical" | null;
  verificationRequired?: boolean;
  message?: string;
};

export async function login(email: string, password: string) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  fullName: string,
  email: string,
  password: string,
  role: "doctor" | "pharmacy" | "medical",
) {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName, email, password, role }),
  });
}

export async function resendConfirmation(email: string) {
  return apiRequest<{ ok: boolean; message: string }>(
    "/api/auth/resend-confirmation",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export async function getSummary() {
  return apiRequest<DashboardSummary>("/api/dashboard/summary");
}

export async function getRiskMap() {
  return apiRequest<{ points: RiskMapPoint[]; source: string }>(
    "/api/dashboard/risk-map",
  );
}

export async function getDashboardTrend() {
  return apiRequest<DashboardTrend>("/api/dashboard/trend");
}

export async function getCommunitySignals() {
  return apiRequest<{ signals: CommunitySignal[] }>("/api/community-signals");
}

export async function getAlerts() {
  return apiRequest<{ alerts: AlertSignal[] }>("/api/alerts");
}

export async function postDoctorEvent(payload: Record<string, unknown>) {
  return apiRequest("/api/doctor-events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function postPharmacySale(payload: Record<string, unknown>) {
  return apiRequest("/api/pharmacy-sales", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function postCommunitySignal(payload: Record<string, unknown>) {
  return apiRequest("/api/community-signals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
