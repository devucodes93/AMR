"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MobileBlocker } from "./components/MobileBlocker";
import {
  ApiError,
  AlertSignal,
  CommunitySignal,
  DashboardSummary,
  getAlerts,
  getCommunitySignals,
  getSummary,
  login,
  postCommunitySignal,
  postDoctorEvent,
  postPharmacySale,
  resendConfirmation,
  register,
} from "../lib/api";

type AuthMode = "login" | "register";
type UserRole = "doctor" | "pharmacy" | "medical";
type Section = "overview" | "entry" | "community" | "alerts" | "analytics";
type GeoState = { latitude: number | null; longitude: number | null };
type ActivityItem = {
  id: string;
  icon: string;
  text: string;
  sub: string;
  time: string;
};

type PharmacyInventoryItem = {
  id: string;
  medicineName: string;
  antibioticClass: string;
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  reorderLevel: number;
  updatedAt: string;
};

type PharmacySaleLedgerItem = {
  id: string;
  medicineName: string;
  quantity: number;
  state: string;
  soldAt: string;
};

type ParsedBillLine = {
  medicineName: string;
  quantity: number;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    hamlet?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    region?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    amenity?: string;
    building?: string;
    shop?: string;
    tourism?: string;
    leisure?: string;
    office?: string;
    hospital?: string;
    university?: string;
    school?: string;
  };
};

type LocationDetails = {
  display_name?: string;
  road?: string;
  pedestrian?: string;
  hamlet?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  region?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  amenity?: string;
  building?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  office?: string;
  hospital?: string;
  university?: string;
  school?: string;
};

const emptySummary: DashboardSummary = {
  totals: {
    salesToday: 0,
    prescriptionsToday: 0,
    diseasesSeenToday: 0,
    alertsToday: 0,
  },
  topDiseases: [],
  topProducts: [],
  source: "fallback",
};

const SESSION_STORAGE_KEY = "amr.web.session.v1";
const PHARMACY_INVENTORY_STORAGE_KEY = "amr.web.pharmacy.inventory.v1";
const PHARMACY_LEDGER_STORAGE_KEY = "amr.web.pharmacy.ledger.v1";

function normalizeRole(
  role: UserRole | null | undefined,
): Exclude<UserRole, "medical"> {
  return role === "doctor" ? "doctor" : "pharmacy";
}

function normalizeMedicineName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isNoiseLine(line: string) {
  return /invoice|subtotal|tax|gst|cgst|sgst|amount|discount|cash|total|receipt|bill\s*no|ph\.?|mobile|address|date/i.test(
    line,
  );
}

function normalizeOcrMedicineText(line: string) {
  return normalizeMedicineName(
    line
      .replace(/[|]/g, "I")
      .replace(/[“”"']/g, "")
      .replace(/[^a-zA-Z0-9+\-()./\s]/g, " "),
  );
}

function upsertInventoryItem(
  list: PharmacyInventoryItem[],
  incoming: {
    medicineName: string;
    antibioticClass?: string;
    purchaseDelta?: number;
    soldDelta?: number;
    reorderLevel?: number;
  },
) {
  const normalizedName = normalizeMedicineName(incoming.medicineName);
  if (!normalizedName) {
    return list;
  }

  const now = new Date().toISOString();
  const existingIndex = list.findIndex(
    (item) => item.medicineName.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existingIndex === -1) {
    const purchased = Math.max(0, Number(incoming.purchaseDelta ?? 0));
    const sold = Math.max(0, Number(incoming.soldDelta ?? 0));
    const stock = Math.max(0, purchased - sold);
    const reorder = Math.max(1, Number(incoming.reorderLevel ?? 10));
    return [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        medicineName: normalizedName,
        antibioticClass: incoming.antibioticClass?.trim() ?? "",
        purchasedQty: purchased,
        soldQty: sold,
        stockQty: stock,
        reorderLevel: reorder,
        updatedAt: now,
      },
      ...list,
    ];
  }

  const existing = list[existingIndex];
  const purchaseDelta = Math.max(0, Number(incoming.purchaseDelta ?? 0));
  const soldDelta = Math.max(0, Number(incoming.soldDelta ?? 0));
  const nextPurchased = existing.purchasedQty + purchaseDelta;
  const nextSold = existing.soldQty + soldDelta;
  const nextStock = Math.max(0, existing.stockQty + purchaseDelta - soldDelta);
  const nextReorder = Math.max(
    1,
    Number(incoming.reorderLevel ?? existing.reorderLevel),
  );

  const updated: PharmacyInventoryItem = {
    ...existing,
    antibioticClass:
      incoming.antibioticClass && incoming.antibioticClass.trim().length > 0
        ? incoming.antibioticClass.trim()
        : existing.antibioticClass,
    purchasedQty: nextPurchased,
    soldQty: nextSold,
    stockQty: nextStock,
    reorderLevel: nextReorder,
    updatedAt: now,
  };

  return list.map((item, index) => (index === existingIndex ? updated : item));
}

function parseBillText(rawText: string): ParsedBillLine[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedBillLine[] = [];
  for (const line of lines) {
    if (isNoiseLine(line)) {
      continue;
    }

    const qtyMatch = line.match(/(?:qty|quantity|x)\s*[:\-]?\s*(\d{1,4})/i);
    const tailMatch = line.match(/(.+?)\s+(\d{1,4})$/);
    const prefixQtyMatch = line.match(/^(\d{1,4})\s+(.+)$/);
    const dashQtyMatch = line.match(/(.+?)\s*[-:]\s*(\d{1,4})$/);

    const pushLine = (medicineRaw: string, qtyRaw: string | number) => {
      const qty = Number(qtyRaw);
      const medicineName = normalizeOcrMedicineText(
        medicineRaw
          .replace(/(?:qty|quantity|x)\s*[:\-]?\s*\d{1,4}/gi, "")
          .replace(/^\d{1,4}\s+/, "")
          .replace(/\s*[-:]\s*\d{1,4}\s*$/, ""),
      );

      if (!medicineName || qty <= 0 || medicineName.length < 3) {
        return;
      }

      const alphaCount = (medicineName.match(/[a-zA-Z]/g) ?? []).length;
      if (alphaCount < 3) {
        return;
      }

      parsed.push({ medicineName, quantity: qty });
    };

    if (qtyMatch) {
      pushLine(line, qtyMatch[1]);
      continue;
    }

    if (dashQtyMatch) {
      pushLine(dashQtyMatch[1], dashQtyMatch[2]);
      continue;
    }

    if (tailMatch) {
      pushLine(tailMatch[1], tailMatch[2]);
      continue;
    }

    if (prefixQtyMatch) {
      pushLine(prefixQtyMatch[2], prefixQtyMatch[1]);
    }
  }

  const merged = new Map<string, { quantity: number; displayName: string }>();
  for (const line of parsed) {
    const key = line.medicineName.toLowerCase();
    const current = merged.get(key);
    if (current) {
      merged.set(key, {
        quantity: current.quantity + line.quantity,
        displayName: current.displayName,
      });
    } else {
      merged.set(key, {
        quantity: line.quantity,
        displayName: line.medicineName,
      });
    }
  }

  return Array.from(merged.entries())
    .map(([, value]) => ({
      medicineName: value.displayName,
      quantity: value.quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

async function preprocessImageForOcr(source: Blob | File) {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / bitmap.width);
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return source;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray =
        0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const boosted = Math.max(0, Math.min(255, gray * 1.2 + 12));
      data[index] = boosted;
      data[index + 1] = boosted;
      data[index + 2] = boosted;
    }
    context.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png", 0.95);
    });

    return blob ?? source;
  } catch {
    return source;
  }
}

/* ── Inline SVG Icons ── */
const Ic = {
  Shield: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Grid: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Pill: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  ),
  Users: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Bell: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  BarChart: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Search: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Menu: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  X: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Logout: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Pin: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  ),
  CheckCirc: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  TrendUp: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  TrendDn: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  AlertTri: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Refresh: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Download: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

function TrendChart({ data }: { data: number[] }) {
  const trendData = data.length >= 2 ? data : [0, 0];
  const width = 420;
  const height = 120;
  const padding = 12;
  const max = Math.max(...trendData);
  const min = Math.min(...trendData);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (trendData.length - 1);

  const points = trendData.map((value, index) => {
    const x = padding + index * stepX;
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y, value };
  });

  let wavePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    const cy = (prev.y + curr.y) / 2;
    wavePath += ` Q ${prev.x},${prev.y} ${cx},${cy}`;
  }
  wavePath += ` T ${points[points.length - 1].x},${points[points.length - 1].y}`;

  const area = `${wavePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
  const current = trendData[trendData.length - 1] ?? 0;
  const previous = trendData[trendData.length - 2] ?? current;
  const change =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 100);

  return (
    <div className="rr-chart-card">
      <div className="rr-panel-hd">
        <h3>Wave Trend</h3>
        <span className="rr-chip info">12 points</span>
      </div>
      <div className="rr-chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="rr-chart-svg"
          role="img"
          aria-label="Trend overview chart"
        >
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((row) => (
            <line
              key={row}
              x1={padding}
              x2={width - padding}
              y1={padding + ((height - padding * 2) / 2) * row}
              y2={padding + ((height - padding * 2) / 2) * row}
              stroke="#e2e8f0"
              strokeDasharray="4 6"
            />
          ))}
          <path d={area} fill="url(#trendFill)" />
          <path
            d={wavePath}
            fill="none"
            stroke="#6b7280"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill="#4b5563"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div className="rr-chart-meta">
        <span>Current: {current}</span>
        <span>Change: {`${change >= 0 ? "+" : ""}${change}%`}</span>
        <span>Peak: {max}</span>
      </div>
    </div>
  );
}

/* ── Stat Card component ── */
function StatCard({
  label,
  value,
  accent,
  icon,
  trend,
  trendVal,
  sub,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neu";
  trendVal?: string;
  sub?: string;
}) {
  return (
    <div
      className="rr-stat-card"
      style={{ "--card-accent": accent } as React.CSSProperties}
    >
      <div className="rr-stat-header">
        <div className="rr-stat-icon">{icon}</div>
        {trend && (
          <div className={`rr-stat-trend ${trend}`}>
            {trend === "up" ? (
              <Ic.TrendUp />
            ) : trend === "down" ? (
              <Ic.TrendDn />
            ) : null}
            {trendVal}
          </div>
        )}
      </div>
      <div className="rr-stat-val">{value}</div>
      <div className="rr-stat-lbl">{label}</div>
      {sub && <div className="rr-stat-sub">{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════ */
export default function Page() {
  /* Auth state */
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("doctor");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>("doctor");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [sessionInfo, setSessionInfo] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [showResend, setShowResend] = useState(false);

  /* Dashboard state */
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [alerts, setAlerts] = useState<AlertSignal[]>([]);
  const [signals, setSignals] = useState<CommunitySignal[]>([]);
  const [geo, setGeo] = useState<GeoState>({ latitude: null, longitude: null });
  const [geoLabel, setGeoLabel] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoDetails, setGeoDetails] = useState<LocationDetails | null>(null);
  const [geoResponse, setGeoResponse] =
    useState<NominatimReverseResponse | null>(null);
  const [isResolvingGeo, setIsResolvingGeo] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  /* Layout state */
  const [section, setSection] = useState<Section>("entry");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /* Entry form state */
  const [diseaseLabel, setDiseaseLabel] = useState("");
  const [doctorAntibiotic, setDoctorAntibiotic] = useState("");
  const [doctorQty, setDoctorQty] = useState(1);
  const [productName, setProductName] = useState("");
  const [pharmacyAntibiotic, setPharmacyAntibiotic] = useState("");
  const [pharmacyQty, setPharmacyQty] = useState(1);
  const [communityArea, setCommunityArea] = useState("");
  const [communitySymptoms, setCommunitySymptoms] = useState("");
  const [communityIntensity, setCommunityIntensity] = useState<
    "Low" | "Medium" | "High"
  >("Low");

  /* Pharmacy inventory state */
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [saleLedger, setSaleLedger] = useState<PharmacySaleLedgerItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [pharmacyMode, setPharmacyMode] = useState<"sales" | "scan">("sales");
  const [stockMedicineName, setStockMedicineName] = useState("");
  const [stockAntibioticClass, setStockAntibioticClass] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [stockReorderLevel, setStockReorderLevel] = useState(10);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [billScanMessage, setBillScanMessage] = useState("");
  const [manualBillText, setManualBillText] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedScanItems, setCapturedScanItems] = useState<ParsedBillLine[]>(
    [],
  );

  const searchRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const rawInventory = localStorage.getItem(PHARMACY_INVENTORY_STORAGE_KEY);
      if (rawInventory) {
        const parsed = JSON.parse(rawInventory) as PharmacyInventoryItem[];
        setInventory(Array.isArray(parsed) ? parsed : []);
      }

      const rawLedger = localStorage.getItem(PHARMACY_LEDGER_STORAGE_KEY);
      if (rawLedger) {
        const parsedLedger = JSON.parse(rawLedger) as PharmacySaleLedgerItem[];
        setSaleLedger(Array.isArray(parsedLedger) ? parsedLedger : []);
      }
    } catch {
      localStorage.removeItem(PHARMACY_INVENTORY_STORAGE_KEY);
      localStorage.removeItem(PHARMACY_LEDGER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PHARMACY_INVENTORY_STORAGE_KEY,
      JSON.stringify(inventory),
    );
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(
      PHARMACY_LEDGER_STORAGE_KEY,
      JSON.stringify(saleLedger),
    );
  }, [saleLedger]);

  const filteredInventory = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    if (!query) {
      return inventory;
    }

    return inventory.filter((item) => {
      return (
        item.medicineName.toLowerCase().includes(query) ||
        item.antibioticClass.toLowerCase().includes(query)
      );
    });
  }, [inventory, inventorySearch]);

  const filteredSalesInventory = useMemo(() => {
    const query = salesSearch.trim().toLowerCase();
    if (!query) {
      return inventory;
    }

    return inventory.filter((item) => {
      return (
        item.medicineName.toLowerCase().includes(query) ||
        item.antibioticClass.toLowerCase().includes(query)
      );
    });
  }, [inventory, salesSearch]);

  const selectedSaleMedicine = useMemo(() => {
    const target = normalizeMedicineName(productName).toLowerCase();
    if (!target) {
      return null;
    }

    return (
      inventory.find((item) => item.medicineName.toLowerCase() === target) ??
      null
    );
  }, [inventory, productName]);

  function chooseMedicineForSale(item: PharmacyInventoryItem) {
    setProductName(item.medicineName);
    setPharmacyAntibiotic(item.antibioticClass);
    setMessage(`Selected ${item.medicineName} for sales entry.`);
    setErrorMessage("");
    setPharmacyMode("sales");
  }

  const lowStockItems = useMemo(() => {
    return inventory
      .filter((item) => item.stockQty <= item.reorderLevel)
      .sort((a, b) => a.stockQty - b.stockQty);
  }, [inventory]);

  const soldByStateRows = useMemo(() => {
    const grouped = new Map<string, number>();
    const targetState = geoStateName.trim().toLowerCase();
    for (const row of saleLedger) {
      if (targetState && row.state.trim().toLowerCase() !== targetState) {
        continue;
      }
      const key = row.medicineName;
      grouped.set(key, (grouped.get(key) ?? 0) + row.quantity);
    }

    return Array.from(grouped.entries())
      .map(([medicineName, quantity]) => ({ medicineName, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [saleLedger, geoStateName]);

  async function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  }

  async function openCamera() {
    setBillScanMessage("");
    setErrorMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setBillScanMessage(
        "Camera is not available in this browser. Use manual stock entry.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);

      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setBillScanMessage("Camera permission denied or unavailable.");
    }
  }

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function importParsedBillLines(
    parsedLines: ParsedBillLine[],
    sourceLabel: string,
  ) {
    setCapturedScanItems(parsedLines);

    if (parsedLines.length === 0) {
      setBillScanMessage(
        "No medicine lines detected. Try a clearer bill image or use manual bill input.",
      );
      return;
    }

    setInventory((prev) => {
      let next = [...prev];
      for (const line of parsedLines) {
        next = upsertInventoryItem(next, {
          medicineName: line.medicineName,
          purchaseDelta: line.quantity,
        });
      }
      return next;
    });

    const totalQty = parsedLines.reduce((sum, line) => sum + line.quantity, 0);
    setBillScanMessage(
      `Imported ${parsedLines.length} medicines from ${sourceLabel} (${totalQty} units total).`,
    );
    setPharmacyMode("scan");
  }

  async function extractBillLinesUsingOcr(source: Blob | File) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const preprocessed = await preprocessImageForOcr(source);
      const primaryResult = await worker.recognize(preprocessed);
      let primaryParsed = parseBillText(primaryResult.data.text || "");

      // Retry with original image if the enhanced pass has low confidence.
      if (primaryParsed.length < 2) {
        const fallbackResult = await worker.recognize(source);
        const fallbackParsed = parseBillText(fallbackResult.data.text || "");
        if (fallbackParsed.length > primaryParsed.length) {
          primaryParsed = fallbackParsed;
        }
      }

      return primaryParsed;
    } finally {
      await worker.terminate();
    }
  }

  async function scanCapturedImage(source: Blob | File) {
    setIsScanningBill(true);
    setBillScanMessage("Scanning bill image...");
    setErrorMessage("");

    try {
      const parsedLines = await extractBillLinesUsingOcr(source);
      importParsedBillLines(parsedLines, "bill scan");
    } catch {
      setBillScanMessage(
        "Bill scan failed. You can still add medicines manually in the stock form or using manual bill input.",
      );
    } finally {
      setIsScanningBill(false);
    }
  }

  async function captureFromCamera() {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;

    if (!video || !canvas) {
      setBillScanMessage("Camera is not ready yet.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setBillScanMessage("Unable to capture camera frame.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
    });

    if (!blob) {
      setBillScanMessage("Camera capture failed.");
      return;
    }

    await stopCamera();
    await scanCapturedImage(blob);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        role?: UserRole | null;
        accessToken?: string | null;
        userId?: string | null;
      };
      const restoredRole = normalizeRole(parsed.role);
      setCurrentRole(restoredRole);
      setCurrentUserId(parsed.userId ?? "");
      setIsAuthenticated(true);
      setSessionInfo(parsed.accessToken ? "Session restored" : "Logged in");
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const trendSeries = useMemo(() => {
    const source = [
      summary.totals.prescriptionsToday,
      summary.totals.salesToday,
      summary.totals.diseasesSeenToday,
      summary.totals.alertsToday,
      signals.length,
    ].map((v) => Math.max(0, Number(v || 0)));

    if (source.every((value) => value === 0)) {
      return Array(12).fill(0);
    }

    return Array.from({ length: 12 }, (_, index) => {
      const curr = source[index % source.length];
      const next = source[(index + 1) % source.length];
      const blend = index % 2 === 0 ? curr : Math.round((curr + next) / 2);
      return Math.max(0, blend);
    });
  }, [summary, signals.length]);

  const activityFeed = useMemo(() => {
    const items: ActivityItem[] = [];

    if (summary.totals.prescriptionsToday > 0) {
      items.push({
        id: "prescriptions",
        icon: "RX",
        text: `${summary.totals.prescriptionsToday} prescriptions recorded today`,
        sub: "Clinical logging pipeline is active.",
        time: "Today",
      });
    }

    if (summary.totals.salesToday > 0) {
      items.push({
        id: "sales",
        icon: "SL",
        text: `${summary.totals.salesToday} pharmacy sales entries captured`,
        sub: "Dispensing records are flowing in real time.",
        time: "Today",
      });
    }

    alerts.slice(0, 3).forEach((alert, index) => {
      items.push({
        id: `alert-${alert.id}`,
        icon: "AL",
        text: alert.title,
        sub: "Alert generated by surveillance rules.",
        time: alert.time || `Alert ${index + 1}`,
      });
    });

    signals.slice(0, 3).forEach((signal) => {
      items.push({
        id: `signal-${signal.id}`,
        icon: "CM",
        text: `Community report from ${signal.area}`,
        sub: signal.symptoms,
        time: signal.reportedAt,
      });
    });

    if (items.length === 0) {
      items.push({
        id: "empty",
        icon: "--",
        text: "No recent operational events",
        sub: "New records, alerts, and community reports will appear here.",
        time: lastRefreshed ? `Updated ${lastRefreshed}` : "Waiting",
      });
    }

    return items.slice(0, 6);
  }, [alerts, signals, summary, lastRefreshed]);

  /* Keyboard shortcuts */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowNotifs(false);
        setShowLogoutModal(false);
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Auth helpers */
  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setErrorMessage("");
    setMessage("");
    setShowResend(false);
  }

  async function handleResend() {
    const e = email.trim();
    if (!e) {
      setErrorMessage("Enter your email first.");
      return;
    }
    setErrorMessage("");
    try {
      const r = await resendConfirmation(e);
      setMessage(r.message || "Verification email resent.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  /* Dashboard refresh */
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [s, a, c] = await Promise.all([
        getSummary(),
        getAlerts(),
        getCommunitySignals(),
      ]);
      setSummary(s);
      setAlerts(a.alerts);
      setSignals(c.signals);
      setLastRefreshed(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refreshDashboard();
  }, [isAuthenticated, refreshDashboard]);

  /* Auto-refresh every 60s */
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => void refreshDashboard(), 60000);
    return () => clearInterval(t);
  }, [isAuthenticated, refreshDashboard]);

  /* Geolocation */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setGeo({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    if (geo.latitude == null || geo.longitude == null) {
      setGeoLabel("");
      setGeoStateName("");
      setGeoDetails(null);
      setGeoResponse(null);
      return;
    }

    const controller = new AbortController();

    async function reverseGeocode() {
      setIsResolvingGeo(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${geo.latitude}&lon=${geo.longitude}&format=jsonv2&addressdetails=1&zoom=18`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("reverse geocode failed");
        }

        const data = (await response.json()) as NominatimReverseResponse;
        const addr = data.address ?? {};
        setGeoResponse(data);
        setGeoDetails({
          display_name: data.display_name,
          ...addr,
        });

        const landmark =
          addr.amenity ??
          addr.hospital ??
          addr.building ??
          addr.shop ??
          addr.tourism ??
          addr.leisure ??
          addr.office ??
          addr.university ??
          addr.school;

        const locality =
          addr.hamlet ??
          addr.neighbourhood ??
          addr.suburb ??
          addr.city ??
          addr.town ??
          addr.village ??
          addr.state_district ??
          addr.county;

        const road = addr.road ?? addr.pedestrian;
        const primary = [road, locality, addr.state, addr.postcode]
          .filter(Boolean)
          .join(", ");
        setGeoStateName(addr.state ?? "");

        if (landmark && primary) {
          setGeoLabel(`${landmark}, ${primary}`);
        } else if (primary) {
          setGeoLabel(primary);
        } else if (data.display_name) {
          setGeoLabel(data.display_name);
        } else {
          setGeoLabel("Location identified");
        }
      } catch {
        if (!controller.signal.aborted) {
          setGeoLabel("Location identified");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingGeo(false);
        }
      }
    }

    void reverseGeocode();
    return () => controller.abort();
  }, [geo.latitude, geo.longitude]);

  const locationDetailsPayload = geoResponse;

  const locationText =
    geo.latitude == null
      ? "Location unavailable"
      : isResolvingGeo
        ? "Resolving location..."
        : geoLabel || "Location identified";

  function handleAddStock(e: FormEvent) {
    e.preventDefault();
    const medicineName = normalizeMedicineName(stockMedicineName);
    if (!medicineName || stockQty <= 0) {
      setErrorMessage("Enter medicine name and valid stock quantity.");
      return;
    }

    setInventory((prev) =>
      upsertInventoryItem(prev, {
        medicineName,
        antibioticClass: stockAntibioticClass,
        purchaseDelta: stockQty,
        reorderLevel: stockReorderLevel,
      }),
    );
    setMessage(`${medicineName} stock updated.`);
    setErrorMessage("");
    setStockMedicineName("");
    setStockAntibioticClass("");
    setStockQty(1);
  }

  async function handleBillScanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setIsScanningBill(true);
    setBillScanMessage("Scanning bill image...");
    setErrorMessage("");

    try {
      const parsedLines = await extractBillLinesUsingOcr(file);
      importParsedBillLines(parsedLines, "uploaded bill");
    } catch {
      setBillScanMessage(
        "Bill scan failed. You can still add medicines manually in the stock form or using manual bill input.",
      );
    } finally {
      setIsScanningBill(false);
      e.target.value = "";
    }
  }

  function handleManualBillImport(e: FormEvent) {
    e.preventDefault();
    const text = manualBillText.trim();
    if (!text) {
      setBillScanMessage("Enter medicine lines before importing manually.");
      return;
    }

    const parsedLines = parseBillText(text);
    importParsedBillLines(parsedLines, "manual bill input");
  }

  /* Auth submit */
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    const em = email.trim(),
      pw = password.trim(),
      nm = fullName.trim();
    if (authMode === "register") {
      if (!nm || !em || pw.length < 6) {
        setErrorMessage(
          "Enter full name, valid email, and password (min 6 chars).",
        );
        return;
      }
    } else if (!em || !pw) {
      setErrorMessage("Enter email and password.");
      return;
    }
    setIsSubmittingAuth(true);
    try {
      if (authMode === "register") {
        await register(nm, em, pw, role);
        setMessage(
          "Verification email sent. Please confirm your email, then log in.",
        );
        setPassword("");
        setAuthMode("login");
        setShowResend(true);
        return;
      } else {
        const r = await login(em, pw);
        const normalizedRole = normalizeRole(r.role);
        setCurrentRole(normalizedRole);
        setSessionInfo(
          r?.session?.access_token ? "Session active" : "Logged in",
        );

        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            role: normalizedRole,
            accessToken: r?.session?.access_token ?? null,
            userId: r?.user?.id ?? null,
            savedAt: new Date().toISOString(),
          }),
        );
        setCurrentUserId(r?.user?.id ?? "");
      }
      setIsAuthenticated(true);
      setMessage("Authenticated successfully.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_confirmed")
        setShowResend(true);
      setErrorMessage(
        err instanceof Error ? err.message : "Authentication failed",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  /* Data entry submits */
  async function handleDoctorSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    try {
      await postDoctorEvent({
        doctorUserId: currentUserId || null,
        facilityId: currentUserId || null,
        diseaseLabel,
        antibioticName: doctorAntibiotic || null,
        quantity: doctorQty,
        latitude: geo.latitude,
        longitude: geo.longitude,
        district: geoDetails?.state_district || geoStateName || null,
        pincode: geoDetails?.postcode || null,
        locationLabel: geoLabel || null,
        locationDetails: locationDetailsPayload,
      });
      setDiseaseLabel("");
      setDoctorAntibiotic("");
      setDoctorQty(1);
      await refreshDashboard();
      setMessage("Doctor event saved successfully.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save event",
      );
    }
  }

  async function handlePharmacySubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    const normalizedProductName = normalizeMedicineName(productName);
    try {
      await postPharmacySale({
        pharmacyUserId: currentUserId || null,
        facilityId: currentUserId || null,
        productName: normalizedProductName,
        antibioticName: pharmacyAntibiotic || null,
        quantity: pharmacyQty,
        latitude: geo.latitude,
        longitude: geo.longitude,
        district: geoDetails?.state_district || geoStateName || null,
        pincode: geoDetails?.postcode || null,
        locationLabel: geoLabel || null,
        locationDetails: locationDetailsPayload,
      });

      setInventory((prev) =>
        upsertInventoryItem(prev, {
          medicineName: normalizedProductName,
          antibioticClass: pharmacyAntibiotic,
          soldDelta: pharmacyQty,
        }),
      );

      setSaleLedger((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          medicineName: normalizedProductName,
          quantity: Math.max(1, Number(pharmacyQty || 1)),
          state: geoStateName || "Unknown",
          soldAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setProductName("");
      setPharmacyAntibiotic("");
      setPharmacyQty(1);
      await refreshDashboard();
      setMessage("Pharmacy sale saved successfully.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save sale",
      );
    }
  }

  async function handleCommunitySubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    try {
      await postCommunitySignal({
        area: communityArea,
        symptoms: communitySymptoms,
        intensity: communityIntensity,
        latitude: geo.latitude,
        longitude: geo.longitude,
        district: geoDetails?.state_district || geoStateName || null,
        pincode: geoDetails?.postcode || null,
        locationLabel: geoLabel || null,
        locationDetails: locationDetailsPayload,
      });
      setCommunityArea("");
      setCommunitySymptoms("");
      setCommunityIntensity("Low");
      await refreshDashboard();
      setMessage("Community signal posted successfully.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to post signal",
      );
    }
  }

  /* ─────────────────────────────────────────
     AUTH SCREEN
  ───────────────────────────────────────── */
  if (!isAuthenticated) {
    return (
      <div className="rr-auth-root">
        <div className="rr-auth-bg">
          <div className="rr-auth-orb rr-orb1" />
          <div className="rr-auth-orb rr-orb2" />
          <div className="rr-auth-orb rr-orb3" />
        </div>
        <div className="rr-grid-overlay" />

        <div className="rr-auth-container">
          <div className="rr-auth-left">
            <div className="rr-auth-join">Join Us</div>
          </div>

          <div className="rr-auth-right">
            <div className="rr-auth-card rr-auth-flat">
              <div className="rr-auth-tabs">
                <button
                  className={`rr-auth-tab ${authMode === "login" ? "active" : ""}`}
                  onClick={() => switchMode("login")}
                >
                  Sign In
                </button>
                <button
                  className={`rr-auth-tab ${authMode === "register" ? "active" : ""}`}
                  onClick={() => switchMode("register")}
                >
                  Register
                </button>
                <div
                  className={`rr-tab-pill ${authMode === "register" ? "right" : ""}`}
                />
              </div>

              <form onSubmit={handleAuthSubmit} key={authMode}>
                <div className="rr-form-title">
                  {authMode === "login" ? "Sign In" : "Create Account"}
                </div>
                <div className="rr-form-sub">
                  {authMode === "login"
                    ? "Access your workspace"
                    : "Register your account"}
                </div>

                <div className="rr-field-stack">
                  {authMode === "register" && (
                    <div className="rr-field">
                      <label>
                        Full Name <span className="req">*</span>
                      </label>
                      <input
                        placeholder="Dr. Priya Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="rr-field">
                    <label>
                      Email Address <span className="req">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="you@hospital.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="rr-field">
                    <label>
                      Password <span className="req">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {authMode === "register" && (
                    <div className="rr-field">
                      <label>
                        Role <span className="req">*</span>
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                      >
                        <option value="doctor">Doctor / Clinician</option>
                        <option value="medical">Medical / Pharmacy</option>
                        <option value="pharmacy">
                          Medical Shop / Pharmacy
                        </option>
                      </select>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="rr-submit-primary"
                >
                  {isSubmittingAuth && <span className="rr-spinner" />}
                  {authMode === "login" ? "Sign In" : "Create Account"}
                </button>

                <button
                  type="button"
                  className="rr-ghost-link"
                  onClick={() =>
                    switchMode(authMode === "login" ? "register" : "login")
                  }
                >
                  {authMode === "login"
                    ? "Don't have an account? Register →"
                    : "Already have an account? Sign in →"}
                </button>

                {showResend && authMode === "login" && (
                  <button
                    type="button"
                    className="rr-ghost-link"
                    onClick={handleResend}
                  >
                    Resend verification email →
                  </button>
                )}

                {message && <div className="rr-toast success">{message}</div>}
                {errorMessage && (
                  <div className="rr-toast error">{errorMessage}</div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────
     DASHBOARD
  ───────────────────────────────────────── */
  const roleLabel = currentRole === "doctor" ? "Doctor" : "Medical Shop";
  const initials = currentRole === "doctor" ? "MD" : "RX";

  const navConfig = [
    {
      id: "entry" as Section,
      label: currentRole === "doctor" ? "Patient Entry" : "Sales Entry",
      icon: <Ic.Pill />,
      badge: null,
    },
    {
      id: "overview" as Section,
      label: "Overview",
      icon: <Ic.Grid />,
      badge: null,
    },
    {
      id: "community" as Section,
      label: "Community Feed",
      icon: <Ic.Users />,
      badge: signals.length > 0 ? String(signals.length) : null,
    },
    {
      id: "alerts" as Section,
      label: "Alerts",
      icon: <Ic.Bell />,
      badge: alerts.length > 0 ? String(alerts.length) : null,
    },
    {
      id: "analytics" as Section,
      label: "Analytics",
      icon: <Ic.BarChart />,
      badge: null,
    },
  ];

  const currentNavLabel = navConfig.find((n) => n.id === section)?.label ?? "";

  return (
    <MobileBlocker>
      <div className="rr-app">
      {/* ── SIDEBAR ── */}
      <aside className={`rr-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="rr-sidebar-head">
          <div className="rr-sidebar-logo">
            <Ic.Shield />
          </div>
          <span className="rr-sidebar-title">ResistanceRadar</span>
        </div>

        <div className="rr-sidebar-body">
          <div className="rr-nav-section-label">Navigation</div>
          {navConfig.map((n) => (
            <button
              key={n.id}
              className={`rr-nav-btn ${section === n.id ? "active" : ""}`}
              onClick={() => setSection(n.id)}
              title={!sidebarOpen ? n.label : undefined}
            >
              <span className="rr-nav-btn-icon">{n.icon}</span>
              <span className="rr-nav-btn-label">{n.label}</span>
              {n.badge && <span className="rr-nav-btn-badge">{n.badge}</span>}
              {section === n.id && <div className="rr-nav-active-bar" />}
            </button>
          ))}

          <div className="rr-nav-section-label" style={{ marginTop: 8 }}>
            System
          </div>
          <button
            className="rr-nav-btn"
            onClick={() => void refreshDashboard()}
            title={!sidebarOpen ? "Refresh" : undefined}
          >
            <span
              className="rr-nav-btn-icon"
              style={{
                color: isRefreshing ? "var(--teal)" : undefined,
                animation: isRefreshing
                  ? "spin 0.8s linear infinite"
                  : undefined,
              }}
            >
              <Ic.Refresh />
            </span>
            <span className="rr-nav-btn-label">Refresh Data</span>
          </button>
        </div>

        <div className="rr-sidebar-foot">
          {sidebarOpen && (
            <div className="rr-user-row">
              <div className="rr-user-ava">{initials}</div>
              <div className="rr-user-meta">
                <span className="rr-user-role-lbl">{roleLabel}</span>
                <span className="rr-user-gps">
                  <span className={`rr-pulse ${geo.latitude ? "on" : "off"}`} />
                  {geo.latitude ? locationText : "GPS unavailable"}
                </span>
              </div>
            </div>
          )}
          <button
            className="rr-nav-btn danger"
            onClick={() => setShowLogoutModal(true)}
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <span className="rr-nav-btn-icon">
              <Ic.Logout />
            </span>
            <span className="rr-nav-btn-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div
        className={`rr-main ${sidebarOpen ? "" : "collapsed"}`}
        style={{
          marginLeft: sidebarOpen
            ? "var(--sidebar-w)"
            : "var(--sidebar-collapsed)",
        }}
      >
        {/* ── NAVBAR ── */}
        <header className="rr-navbar">
          <button
            className="rr-navbar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <Ic.X /> : <Ic.Menu />}
          </button>

          <div className="rr-navbar-crumb">
            <span className="rr-crumb-root">AMR Portal</span>
            <span className="rr-crumb-sep">/</span>
            <span className="rr-crumb-page">{currentNavLabel}</span>
          </div>

          <div className="rr-navbar-end">
            <div className="rr-search-box">
              <span className="rr-search-icon">
                <Ic.Search />
              </span>
              <input
                ref={searchRef}
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="rr-kbd">⌘K</span>
            </div>

            <button
              className="rr-icon-btn"
              onClick={() => void refreshDashboard()}
              title="Refresh"
            >
              <span
                style={{
                  animation: isRefreshing
                    ? "spin 0.8s linear infinite"
                    : undefined,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Ic.Refresh />
              </span>
            </button>

            <button
              className="rr-icon-btn"
              onClick={() => setShowNotifs((v) => !v)}
              title="Notifications"
            >
              <Ic.Bell />
              {alerts.length > 0 && <span className="rr-notif-dot" />}
            </button>

            <div className="rr-role-chip">{roleLabel}</div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="rr-page rr-page-anim">
          {message && (
            <div className="rr-page-toast success">
              <Ic.CheckCirc />
              {message}
            </div>
          )}
          {errorMessage && (
            <div className="rr-page-toast error">
              <Ic.AlertTri />
              {errorMessage}
            </div>
          )}

          {/* ════ OVERVIEW ════ */}
          {section === "overview" && (
            <>
              <div className="rr-page-header">
                <h2>Dashboard Overview</h2>
                <p>
                  Real-time AMR surveillance · {sessionInfo || "Authenticated"}
                  {lastRefreshed && (
                    <>
                      {" "}
                      · Last updated:{" "}
                      <strong style={{ color: "#0f172a" }}>
                        {lastRefreshed}
                      </strong>
                    </>
                  )}
                </p>
              </div>

              <div className="rr-stat-grid">
                {currentRole === "pharmacy" ? (
                  <>
                    <StatCard
                      label="Sales Today"
                      value={summary.totals.salesToday}
                      accent="#000000"
                      icon={<Ic.Pill />}
                      trend="up"
                      trendVal="+12%"
                      sub="vs. yesterday"
                    />
                    <StatCard
                      label="Alerts Today"
                      value={summary.totals.alertsToday}
                      accent="#000000"
                      icon={<Ic.Bell />}
                      trend={summary.totals.alertsToday > 0 ? "down" : "neu"}
                      trendVal={
                        summary.totals.alertsToday > 0 ? "Active" : "Clear"
                      }
                    />
                    <StatCard
                      label="Top Product"
                      value={summary.topProducts[0]?.count ?? 0}
                      accent="#000000"
                      icon={<Ic.BarChart />}
                      trend="up"
                      trendVal="+5%"
                      sub="units dispensed"
                    />
                  </>
                ) : (
                  <>
                    <StatCard
                      label="Prescriptions"
                      value={summary.totals.prescriptionsToday}
                      accent="#000000"
                      icon={<Ic.Pill />}
                      trend="up"
                      trendVal="+8%"
                      sub="today's total"
                    />
                    <StatCard
                      label="Diseases Logged"
                      value={summary.totals.diseasesSeenToday}
                      accent="#000000"
                      icon={<Ic.Grid />}
                      trend="neu"
                      trendVal="Stable"
                      sub="unique conditions"
                    />
                    <StatCard
                      label="Alerts Today"
                      value={summary.totals.alertsToday}
                      accent="#000000"
                      icon={<Ic.Bell />}
                      trend={summary.totals.alertsToday > 0 ? "down" : "neu"}
                      trendVal={
                        summary.totals.alertsToday > 0 ? "Active" : "Clear"
                      }
                    />
                  </>
                )}
              </div>

              <div className="rr-two-col" style={{ marginBottom: 20 }}>
                <TrendChart data={trendSeries} />

                {/* Top diseases / products */}
                <div className="rr-panel">
                  <div className="rr-panel-hd">
                    <h3>
                      {currentRole === "doctor"
                        ? "Top Diseases Seen"
                        : "Top Products Sold"}
                    </h3>
                    <span className="rr-chip">Today</span>
                  </div>
                  {(currentRole === "doctor"
                    ? summary.topDiseases
                    : summary.topProducts
                  ).length === 0 ? (
                    <div className="rr-empty">No data recorded yet</div>
                  ) : (
                    <div className="rr-list">
                      {(currentRole === "doctor"
                        ? summary.topDiseases
                        : summary.topProducts
                      ).map((item, i) => (
                        <div key={item.name} className="rr-list-row">
                          <span className="rr-list-rank">#{i + 1}</span>
                          <span className="rr-list-name">{item.name}</span>
                          <span className="rr-list-count">{item.count}</span>
                          <div
                            className="rr-list-bar"
                            style={{
                              width: `${Math.min(100, item.count * 8)}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent alerts */}
                <div className="rr-panel">
                  <div className="rr-panel-hd">
                    <h3>Recent Alerts</h3>
                    <button
                      className="rr-link-btn"
                      onClick={() => setSection("alerts")}
                    >
                      View all →
                    </button>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="rr-empty">
                      No active alerts — system is monitoring
                    </div>
                  ) : (
                    alerts.slice(0, 5).map((a) => (
                      <div key={a.id} className="rr-alert-row">
                        <div className="rr-alert-pip" />
                        <div>
                          <div className="rr-alert-title">{a.title}</div>
                          <div className="rr-alert-time">{a.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activity feed */}
              <div className="rr-panel">
                <div className="rr-panel-hd">
                  <h3>Recent Activity</h3>
                  <span className="rr-chip info">Operational</span>
                </div>
                <div className="rr-activity-list">
                  {activityFeed.map((a) => (
                    <div key={a.id} className="rr-activity-item">
                      <div className="rr-activity-icon">{a.icon}</div>
                      <div className="rr-activity-text">
                        <div className="rr-activity-main">{a.text}</div>
                        <div className="rr-activity-sub">{a.sub}</div>
                      </div>
                      <div className="rr-activity-time">{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ════ ENTRY ════ */}
          {section === "entry" && (
            <>
              <div className="rr-page-header">
                <h2>
                  {currentRole === "doctor"
                    ? "Clinical Record Entry"
                    : "Dispensing Record Entry"}
                </h2>
                <p>
                  {currentRole === "doctor"
                    ? "Start here. Capture the case details first, then submit the clinical record with location context."
                    : "Start here. Enter the dispensing details first, then submit the pharmacy record with location context."}
                </p>
              </div>

              <div className="rr-form-card" style={{ maxWidth: 760 }}>
                <div className="rr-panel-hd" style={{ marginBottom: 22 }}>
                  <h3>
                    {currentRole === "doctor"
                      ? "New Clinical Record"
                      : "New Dispensing Record"}
                  </h3>
                  {geo.latitude && (
                    <span className="rr-chip success">GPS Active</span>
                  )}
                </div>

                {currentRole === "doctor" ? (
                  <form onSubmit={handleDoctorSubmit}>
                    <div className="rr-form-grid">
                      <div className="rr-field">
                        <label>
                          Disease / Condition <span className="req">*</span>
                        </label>
                        <input
                          placeholder="e.g. Urinary Tract Infection"
                          value={diseaseLabel}
                          onChange={(e) => setDiseaseLabel(e.target.value)}
                          required
                        />
                      </div>
                      <div className="rr-field">
                        <label>
                          Antibiotic Prescribed{" "}
                          <span className="opt">optional</span>
                        </label>
                        <input
                          placeholder="e.g. Amoxicillin 500mg"
                          value={doctorAntibiotic}
                          onChange={(e) => setDoctorAntibiotic(e.target.value)}
                        />
                      </div>
                      <div className="rr-field">
                        <label>
                          Cases / Quantity <span className="req">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={doctorQty}
                          onChange={(e) =>
                            setDoctorQty(Number(e.target.value || 1))
                          }
                          required
                        />
                      </div>
                      <div className="rr-field">
                        <label>GPS Location</label>
                        <div className="rr-geo-pill">
                          <Ic.Pin />
                          {locationText}
                        </div>
                      </div>
                    </div>
                    <div className="rr-form-footer">
                      <span className="rr-form-footer-info">
                        Event will be tagged with current timestamp and GPS
                        coordinates
                      </span>
                      <button type="submit" className="rr-btn-primary">
                        <Ic.CheckCirc />
                        Submit Record
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rr-stock-shell">
                    <div className="rr-tab-strip">
                      <button
                        type="button"
                        className={`rr-tab-btn ${pharmacyMode === "sales" ? "active" : ""}`}
                        onClick={() => setPharmacyMode("sales")}
                      >
                        Sales Entry
                      </button>
                      <button
                        type="button"
                        className={`rr-tab-btn ${pharmacyMode === "scan" ? "active" : ""}`}
                        onClick={() => setPharmacyMode("scan")}
                      >
                        Scan + Track
                      </button>
                    </div>

                    {pharmacyMode === "sales" ? (
                      <div className="rr-panel rr-stock-panel">
                        <div className="rr-panel-hd">
                          <h3>Sales Entry</h3>
                          <span className="rr-chip">
                            Search and select tablet
                          </span>
                        </div>

                        <div className="rr-stock-toolbar">
                          <div className="rr-search-box rr-stock-search">
                            <span className="rr-search-icon">
                              <Ic.Search />
                            </span>
                            <input
                              placeholder="Search tablet or class"
                              value={salesSearch}
                              onChange={(e) => setSalesSearch(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="rr-stock-table-wrap rr-select-table-wrap">
                          <table className="rr-stock-table rr-select-table">
                            <thead>
                              <tr>
                                <th>Medicine</th>
                                <th>Class</th>
                                <th>In Stock</th>
                                <th>Select</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredSalesInventory.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="rr-stock-empty">
                                    No medicines available. Add stock in the
                                    Scan + Track tab first.
                                  </td>
                                </tr>
                              ) : (
                                filteredSalesInventory.map((item) => {
                                  const isSelected =
                                    item.medicineName.toLowerCase() ===
                                    normalizeMedicineName(
                                      productName,
                                    ).toLowerCase();
                                  return (
                                    <tr
                                      key={`sale-${item.id}`}
                                      className={isSelected ? "selected" : ""}
                                    >
                                      <td>{item.medicineName}</td>
                                      <td>{item.antibioticClass || "--"}</td>
                                      <td>{item.stockQty}</td>
                                      <td>
                                        <button
                                          type="button"
                                          className="rr-stock-select-btn"
                                          onClick={() =>
                                            chooseMedicineForSale(item)
                                          }
                                        >
                                          {isSelected ? "Selected" : "Select"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="rr-sale-picked">
                          <div>
                            <span className="rr-chart-label">
                              Selected tablet
                            </span>
                            <strong>
                              {productName || "Pick a tablet from the list"}
                            </strong>
                          </div>
                          <div>
                            <span className="rr-chart-label">
                              Available stock
                            </span>
                            <strong>
                              {selectedSaleMedicine?.stockQty ?? 0}
                            </strong>
                          </div>
                        </div>

                        <form
                          onSubmit={handlePharmacySubmit}
                          style={{ marginTop: 16 }}
                        >
                          <div className="rr-form-grid">
                            <div className="rr-field rr-form-grid-full">
                              <label>
                                Selected Tablet <span className="req">*</span>
                              </label>
                              <input
                                placeholder="Select from list above"
                                value={productName}
                                readOnly
                                required
                              />
                            </div>
                            <div className="rr-field">
                              <label>
                                Antibiotic Class{" "}
                                <span className="opt">auto-filled</span>
                              </label>
                              <input
                                placeholder="Auto-filled from inventory"
                                value={pharmacyAntibiotic}
                                onChange={(e) =>
                                  setPharmacyAntibiotic(e.target.value)
                                }
                              />
                            </div>
                            <div className="rr-field">
                              <label>
                                Quantity Sold <span className="req">*</span>
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={pharmacyQty}
                                onChange={(e) =>
                                  setPharmacyQty(Number(e.target.value || 1))
                                }
                                required
                              />
                            </div>
                          </div>
                          <div className="rr-form-footer">
                            <span className="rr-form-footer-info">
                              Select a medicine first, then enter sold quantity.
                            </span>
                            <button type="submit" className="rr-btn-primary">
                              <Ic.CheckCirc />
                              Record Sale
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="rr-stock-shell-vertical">
                        <div className="rr-panel rr-stock-panel">
                          <div className="rr-panel-hd">
                            <h3>Scan Bill With Camera</h3>
                            <span className="rr-chip">Camera opens first</span>
                          </div>
                          <div className="rr-scan-actions">
                            <button
                              type="button"
                              className="rr-btn-primary"
                              onClick={openCamera}
                            >
                              <Ic.Search />
                              Open Camera To Scan
                            </button>
                            <span className="rr-bill-scan-msg">
                              Scan a bill to auto-fill medicine names and
                              quantities into the table.
                            </span>
                          </div>

                          <div className="rr-field" style={{ marginTop: 12 }}>
                            <label>Upload Bill Image</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleBillScanUpload}
                              disabled={isScanningBill}
                            />
                          </div>

                          <form onSubmit={handleManualBillImport}>
                            <div className="rr-field" style={{ marginTop: 12 }}>
                              <label>Manual Bill Input</label>
                              <textarea
                                placeholder={
                                  "Paste lines like:\nAmoxicillin 500mg 2\nAzithromycin 250mg qty 1"
                                }
                                rows={4}
                                value={manualBillText}
                                onChange={(e) =>
                                  setManualBillText(e.target.value)
                                }
                              />
                            </div>
                            <div
                              className="rr-form-footer"
                              style={{ marginTop: 8 }}
                            >
                              <span className="rr-form-footer-info">
                                Use this when OCR misses lines. We will parse
                                and import medicine names + quantities.
                              </span>
                              <button
                                type="submit"
                                className="rr-btn-secondary"
                              >
                                Import Manual Bill
                              </button>
                            </div>
                          </form>

                          {billScanMessage && (
                            <div className="rr-scan-note">
                              {billScanMessage}
                            </div>
                          )}

                          {capturedScanItems.length > 0 && (
                            <div className="rr-stock-table-wrap rr-scan-result-wrap">
                              <table className="rr-stock-table">
                                <thead>
                                  <tr>
                                    <th>Scanned Medicine</th>
                                    <th>Quantity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {capturedScanItems.map((item) => (
                                    <tr
                                      key={`${item.medicineName}-${item.quantity}`}
                                    >
                                      <td>{item.medicineName}</td>
                                      <td>{item.quantity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="rr-panel rr-stock-panel">
                          <div className="rr-panel-hd">
                            <h3>Stock Intake</h3>
                            <span className="rr-chip">Opening / New Stock</span>
                          </div>
                          <form onSubmit={handleAddStock}>
                            <div className="rr-form-grid">
                              <div className="rr-field">
                                <label>
                                  Medicine Name <span className="req">*</span>
                                </label>
                                <input
                                  placeholder="e.g. Amoxicillin 500mg"
                                  value={stockMedicineName}
                                  onChange={(e) =>
                                    setStockMedicineName(e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <div className="rr-field">
                                <label>
                                  Antibiotic Class{" "}
                                  <span className="opt">optional</span>
                                </label>
                                <input
                                  placeholder="e.g. Penicillin"
                                  value={stockAntibioticClass}
                                  onChange={(e) =>
                                    setStockAntibioticClass(e.target.value)
                                  }
                                />
                              </div>
                              <div className="rr-field">
                                <label>
                                  Quantity Received{" "}
                                  <span className="req">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={stockQty}
                                  onChange={(e) =>
                                    setStockQty(Number(e.target.value || 1))
                                  }
                                  required
                                />
                              </div>
                              <div className="rr-field">
                                <label>
                                  Reorder Level <span className="req">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={stockReorderLevel}
                                  onChange={(e) =>
                                    setStockReorderLevel(
                                      Number(e.target.value || 10),
                                    )
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div className="rr-form-footer">
                              <span className="rr-form-footer-info">
                                Add medicine you bought to maintain live stock.
                              </span>
                              <button type="submit" className="rr-btn-primary">
                                <Ic.CheckCirc />
                                Add To Stock
                              </button>
                            </div>
                          </form>
                        </div>

                        <div className="rr-panel rr-stock-panel">
                          <div className="rr-panel-hd">
                            <h3>Inventory Tracker</h3>
                            <span className="rr-chip">
                              {inventory.length} medicines
                            </span>
                          </div>

                          <div className="rr-stock-toolbar">
                            <div className="rr-search-box rr-stock-search">
                              <span className="rr-search-icon">
                                <Ic.Search />
                              </span>
                              <input
                                placeholder="Search medicine or class"
                                value={inventorySearch}
                                onChange={(e) =>
                                  setInventorySearch(e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="rr-stock-table-wrap">
                            <table className="rr-stock-table">
                              <thead>
                                <tr>
                                  <th>Medicine</th>
                                  <th>Class</th>
                                  <th>Purchased</th>
                                  <th>Sold</th>
                                  <th>In Stock</th>
                                  <th>Need To Buy</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredInventory.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="rr-stock-empty">
                                      No medicines found. Add stock manually or
                                      scan a bill.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredInventory.map((item) => {
                                    const needToBuy = Math.max(
                                      0,
                                      item.reorderLevel - item.stockQty,
                                    );
                                    return (
                                      <tr key={item.id}>
                                        <td>{item.medicineName}</td>
                                        <td>{item.antibioticClass || "--"}</td>
                                        <td>{item.purchasedQty}</td>
                                        <td>{item.soldQty}</td>
                                        <td>{item.stockQty}</td>
                                        <td>
                                          {needToBuy > 0 ? (
                                            <span className="rr-stock-alert">
                                              Buy {needToBuy}
                                            </span>
                                          ) : (
                                            <span className="rr-stock-ok">
                                              OK
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {lowStockItems.length > 0 && (
                            <div className="rr-stock-reorder-box">
                              <h4>Need To Buy Soon</h4>
                              <ul>
                                {lowStockItems.slice(0, 6).map((item) => (
                                  <li key={`low-${item.id}`}>
                                    {item.medicineName} - Buy{" "}
                                    {Math.max(
                                      0,
                                      item.reorderLevel - item.stockQty,
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="rr-panel rr-stock-panel">
                          <div className="rr-panel-hd">
                            <h3>Sold In State {geoStateName || "(Unknown)"}</h3>
                            <span className="rr-chip">Top sold tablets</span>
                          </div>
                          <div className="rr-stock-table-wrap">
                            <table className="rr-stock-table">
                              <thead>
                                <tr>
                                  <th>Medicine</th>
                                  <th>Sold Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {soldByStateRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={2} className="rr-stock-empty">
                                      No state sales data yet. Record sales to
                                      build this table.
                                    </td>
                                  </tr>
                                ) : (
                                  soldByStateRows.map((row) => (
                                    <tr key={`state-${row.medicineName}`}>
                                      <td>{row.medicineName}</td>
                                      <td>{row.quantity}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════ COMMUNITY ════ */}
          {section === "community" && (
            <>
              <div className="rr-page-header">
                <h2>Community Symptom Feed</h2>
                <p>
                  Submit and monitor symptom clusters from the community — helps
                  identify outbreak zones early
                </p>
              </div>

              <div className="rr-two-col">
                <div className="rr-form-card">
                  <div className="rr-panel-hd" style={{ marginBottom: 22 }}>
                    <h3>Submit Community Report</h3>
                    {geo.latitude && (
                      <span className="rr-chip success">GPS Active</span>
                    )}
                  </div>
                  <form onSubmit={handleCommunitySubmit}>
                    <div className="rr-field-stack">
                      <div className="rr-field">
                        <label>
                          Area / Locality <span className="req">*</span>
                        </label>
                        <input
                          placeholder="e.g. Koramangala, Bengaluru"
                          value={communityArea}
                          onChange={(e) => setCommunityArea(e.target.value)}
                          required
                        />
                      </div>
                      <div className="rr-field">
                        <label>
                          Symptoms Observed <span className="req">*</span>
                        </label>
                        <textarea
                          placeholder="Describe symptoms seen in the area — e.g. high fever, respiratory distress, diarrhoea cluster…"
                          value={communitySymptoms}
                          onChange={(e) => setCommunitySymptoms(e.target.value)}
                          rows={4}
                          required
                        />
                      </div>
                      <div className="rr-field">
                        <label>Outbreak Severity</label>
                        <div className="rr-intensity-row">
                          {(["Low", "Medium", "High"] as const).map((lv) => (
                            <button
                              key={lv}
                              type="button"
                              className={`rr-intensity-btn ${communityIntensity === lv ? `active-${lv.toLowerCase()}` : ""}`}
                              onClick={() => setCommunityIntensity(lv)}
                            >
                              {lv}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="rr-field">
                        <label>GPS Location</label>
                        <div className="rr-geo-pill">
                          <Ic.Pin />
                          {locationText}
                        </div>
                      </div>
                    </div>
                    <div className="rr-form-footer">
                      <span className="rr-form-footer-info">
                        Reports are anonymous and help track outbreak zones
                      </span>
                      <button type="submit" className="rr-btn-primary">
                        <Ic.CheckCirc />
                        Post Signal
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rr-panel">
                  <div className="rr-panel-hd">
                    <h3>Community Reports</h3>
                    <span className="rr-chip">{signals.length} reports</span>
                  </div>
                  {signals.length === 0 ? (
                    <div className="rr-empty">
                      No community reports yet — be the first to report
                    </div>
                  ) : (
                    <div className="rr-signal-list">
                      {signals.slice(0, 8).map((s) => (
                        <div key={s.id} className="rr-signal-row">
                          <div
                            className={`rr-intensity ${s.intensity.toLowerCase()}`}
                          >
                            {s.intensity}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="rr-signal-area">{s.area}</div>
                            <div className="rr-signal-symp">{s.symptoms}</div>
                            <div className="rr-signal-meta">{s.reportedAt}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ════ ALERTS ════ */}
          {section === "alerts" && (
            <>
              <div className="rr-page-header">
                <h2>Alert Center</h2>
                <p>
                  System-generated AMR resistance alerts and outbreak
                  notifications
                </p>
              </div>

              <div className="rr-stat-grid" style={{ marginBottom: 24 }}>
                <StatCard
                  label="Active Alerts"
                  value={alerts.length}
                  accent="#000000"
                  icon={<Ic.Bell />}
                  trend={alerts.length > 0 ? "down" : "neu"}
                  trendVal={
                    alerts.length > 0 ? "Requires attention" : "All clear"
                  }
                />
                <StatCard
                  label="Community Signals"
                  value={signals.length}
                  accent="#000000"
                  icon={<Ic.Users />}
                  trend="neu"
                  trendVal="Monitoring"
                />
                <StatCard
                  label="High Severity"
                  value={signals.filter((s) => s.intensity === "High").length}
                  accent="#000000"
                  icon={<Ic.AlertTri />}
                  trend={
                    signals.filter((s) => s.intensity === "High").length > 0
                      ? "down"
                      : "neu"
                  }
                  trendVal="Active"
                />
              </div>

              <div className="rr-panel">
                <div className="rr-panel-hd">
                  <h3>All System Alerts</h3>
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span className="rr-chip warn">{alerts.length} active</span>
                    <button
                      className="rr-icon-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => void refreshDashboard()}
                      title="Refresh alerts"
                    >
                      <span
                        style={{
                          animation: isRefreshing
                            ? "spin 0.8s linear infinite"
                            : undefined,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Ic.Refresh />
                      </span>
                    </button>
                  </div>
                </div>
                {alerts.length === 0 ? (
                  <div className="rr-empty">
                    No alerts — the system is actively monitoring for resistance
                    patterns
                  </div>
                ) : (
                  <div className="rr-alert-cards">
                    {alerts.map((a) => (
                      <div key={a.id} className="rr-alert-card">
                        <div className="rr-alert-card-icon">
                          <Ic.Bell />
                        </div>
                        <div>
                          <div className="rr-alert-card-title">{a.title}</div>
                          <div className="rr-alert-card-time">{a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════ ANALYTICS ════ */}
          {section === "analytics" && (
            <>
              <div className="rr-page-header">
                <h2>Analytics</h2>
                <p>
                  Comprehensive AMR surveillance trends and stewardship metrics
                </p>
              </div>

              <div className="rr-stat-grid" style={{ marginBottom: 28 }}>
                <StatCard
                  label="Prescriptions"
                  value={summary.totals.prescriptionsToday}
                  accent="#000000"
                  icon={<Ic.Pill />}
                  trend="up"
                  trendVal="+8%"
                />
                <StatCard
                  label="Sales Today"
                  value={summary.totals.salesToday}
                  accent="#000000"
                  icon={<Ic.BarChart />}
                  trend="up"
                  trendVal="+12%"
                />
                <StatCard
                  label="Diseases Seen"
                  value={summary.totals.diseasesSeenToday}
                  accent="#000000"
                  icon={<Ic.Grid />}
                  trend="neu"
                  trendVal="Stable"
                />
                <StatCard
                  label="Total Alerts"
                  value={summary.totals.alertsToday}
                  accent="#000000"
                  icon={<Ic.Bell />}
                  trend={summary.totals.alertsToday > 0 ? "down" : "neu"}
                  trendVal={summary.totals.alertsToday > 0 ? "Active" : "Clear"}
                />
              </div>

              <div className="rr-two-col" style={{ marginBottom: 20 }}>
                <div className="rr-panel">
                  <div className="rr-panel-hd">
                    <h3>Disease Distribution</h3>
                    <button
                      className="rr-icon-btn"
                      style={{ width: 28, height: 28 }}
                      title="Export"
                    >
                      <Ic.Download />
                    </button>
                  </div>
                  {summary.topDiseases.length === 0 ? (
                    <div className="rr-empty">No disease data available</div>
                  ) : (
                    <div className="rr-list" style={{ gap: 6 }}>
                      {summary.topDiseases.map((d, i) => (
                        <div key={d.name} className="rr-analytic-row">
                          <span className="rr-analytic-rank">#{i + 1}</span>
                          <div className="rr-analytic-body">
                            <div className="rr-analytic-name">{d.name}</div>
                            <div className="rr-analytic-track">
                              <div
                                className="rr-analytic-fill c-teal"
                                style={{
                                  width: `${Math.min(100, d.count * 10)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="rr-analytic-count">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rr-panel">
                  <div className="rr-panel-hd">
                    <h3>Product Distribution</h3>
                    <button
                      className="rr-icon-btn"
                      style={{ width: 28, height: 28 }}
                      title="Export"
                    >
                      <Ic.Download />
                    </button>
                  </div>
                  {summary.topProducts.length === 0 ? (
                    <div className="rr-empty">No product data available</div>
                  ) : (
                    <div className="rr-list" style={{ gap: 6 }}>
                      {summary.topProducts.map((p, i) => (
                        <div key={p.name} className="rr-analytic-row">
                          <span className="rr-analytic-rank">#{i + 1}</span>
                          <div className="rr-analytic-body">
                            <div className="rr-analytic-name">{p.name}</div>
                            <div className="rr-analytic-track">
                              <div
                                className="rr-analytic-fill c-indigo"
                                style={{
                                  width: `${Math.min(100, p.count * 10)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="rr-analytic-count">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Community signal breakdown */}
              <div className="rr-panel">
                <div className="rr-panel-hd">
                  <h3>Community Signal Severity Breakdown</h3>
                  <span className="rr-chip">{signals.length} total</span>
                </div>
                <div className="rr-stat-grid" style={{ margin: 0 }}>
                  {(["Low", "Medium", "High"] as const).map((sev) => {
                    const count = signals.filter(
                      (s) => s.intensity === sev,
                    ).length;
                    const accent =
                      sev === "Low"
                        ? "#22c55e"
                        : sev === "Medium"
                          ? "#f59e0b"
                          : "#ef4444";
                    return (
                      <div
                        key={sev}
                        className="rr-stat-card"
                        style={
                          { "--card-accent": accent } as React.CSSProperties
                        }
                      >
                        <div className="rr-stat-val">{count}</div>
                        <div className="rr-stat-lbl">{sev} Severity</div>
                        <div className="rr-stat-sub">
                          {signals.length > 0
                            ? `${Math.round((count / signals.length) * 100)}% of total`
                            : "0% of total"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── NOTIFICATION PANEL ── */}
      {showNotifs && (
        <div className="rr-notif-overlay" onClick={() => setShowNotifs(false)}>
          <div className="rr-notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="rr-notif-head">
              <h3>Notifications</h3>
              <button
                className="rr-navbar-toggle"
                style={{ background: "transparent" }}
                onClick={() => setShowNotifs(false)}
              >
                <Ic.X />
              </button>
            </div>
            <div className="rr-notif-body">
              {alerts.length === 0 ? (
                <div className="rr-empty">No notifications at this time</div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="rr-notif-item">
                    <div className="rr-notif-item-title">
                      <span className="rr-notif-dot" />
                      {a.title}
                    </div>
                    <div className="rr-notif-item-time">{a.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="rr-camera-overlay">
          <div className="rr-camera-modal">
            <div className="rr-panel-hd">
              <h3>Bill Scanner Camera</h3>
              <span className="rr-chip">Live preview</span>
            </div>
            <div className="rr-camera-frame">
              <video ref={cameraVideoRef} autoPlay playsInline muted />
              <canvas ref={cameraCanvasRef} className="rr-camera-canvas" />
            </div>
            <div className="rr-camera-actions">
              <button
                type="button"
                className="rr-btn-secondary"
                onClick={() => void stopCamera()}
              >
                Close Camera
              </button>
              <button
                type="button"
                className="rr-btn-primary"
                onClick={() => void captureFromCamera()}
              >
                <Ic.CheckCirc />
                Capture Bill
              </button>
            </div>
            <p className="rr-camera-help">
              Point the camera at the bill. We will capture the image and
              auto-fill medicines + quantities.
            </p>
          </div>
        </div>
      )}

      {/* ── LOGOUT MODAL ── */}
      {showLogoutModal && (
        <div
          className="rr-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="rr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rr-modal-icon">
              <Ic.Logout />
            </div>
            <h3>Sign out of ResistanceRadar?</h3>
            <p>
              You'll need to sign in again to access your dashboard and any
              unsaved data will be lost.
            </p>
            <div className="rr-modal-actions">
              <button
                className="rr-btn-secondary"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="rr-btn-danger"
                onClick={() => {
                  localStorage.removeItem(SESSION_STORAGE_KEY);
                  setIsAuthenticated(false);
                  setCurrentUserId("");
                  setSessionInfo("");
                  setMessage("");
                  setErrorMessage("");
                  setShowLogoutModal(false);
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </MobileBlocker>
  );
}
