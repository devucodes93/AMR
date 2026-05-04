import { Router } from "express";
import { hasSupabaseConfig, supabaseAdmin } from "../lib/supabase.js";
import { getAiAlerts } from "../lib/aiClient.js";
import { getAiZones } from "../lib/aiClient.js";

const router = Router();

function rollingWindowStartIso(hours = 24) {
  const now = Date.now();
  const windowMs = Math.max(1, Number(hours || 24)) * 60 * 60 * 1000;
  return new Date(now - windowMs).toISOString();
}

function toTimestampMs(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function createTimeBuckets({ windowHours = 24, bucketHours = 2 }) {
  const safeWindowHours = Math.max(1, Number(windowHours || 24));
  const safeBucketHours = Math.max(1, Number(bucketHours || 2));
  const bucketMs = safeBucketHours * 60 * 60 * 1000;
  const bucketCount = Math.max(1, Math.floor(safeWindowHours / safeBucketHours));
  const now = Date.now();
  const windowStart = now - bucketCount * bucketMs;

  const points = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = windowStart + index * bucketMs;
    return {
      bucketStart: new Date(bucketStart).toISOString(),
      sales: 0,
      prescriptions: 0,
      alerts: 0,
      signals: 0,
      total: 0,
    };
  });

  function indexFor(timestampValue) {
    const timeMs = toTimestampMs(timestampValue);
    if (timeMs == null || timeMs < windowStart || timeMs >= now) {
      return -1;
    }

    const index = Math.floor((timeMs - windowStart) / bucketMs);
    return index >= 0 && index < points.length ? index : -1;
  }

  return {
    points,
    indexFor,
    windowHours: safeWindowHours,
    bucketHours: safeBucketHours,
  };
}

function countAlertsSince(alerts = [], dayStartIso) {
  const dayStartMs = Date.parse(dayStartIso);
  if (Number.isNaN(dayStartMs)) {
    return alerts.length;
  }

  return alerts.filter((alert) => {
    const alertTime = alert.time ?? alert.created_at ?? alert.createdAt;
    if (!alertTime) {
      return false;
    }

    const alertMs = Date.parse(String(alertTime));
    return !Number.isNaN(alertMs) && alertMs >= dayStartMs;
  }).length;
}

router.get("/summary", async (_req, res) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.json({
      totals: {
        salesToday: 0,
        prescriptionsToday: 0,
        diseasesSeenToday: 0,
        alertsToday: 0,
      },
      topDiseases: [],
      topProducts: [],
      source: "fallback",
    });
  }

  const dayStart = rollingWindowStartIso(24);

  const [salesResp, prescriptionResp, alertsResp, aiAlertsResp] = await Promise.all([
    supabaseAdmin
      .from("pharmacy_sales_events")
      .select("product_name, quantity, event_time")
      .gte("event_time", dayStart),
    supabaseAdmin
      .from("prescription_events")
      .select("disease_label, quantity, event_time")
      .gte("event_time", dayStart),
    supabaseAdmin
      .from("alerts")
      .select("id, created_at")
      .gte("created_at", dayStart),
    getAiAlerts(),
  ]);

  if (salesResp.error || prescriptionResp.error || alertsResp.error) {
    return res.status(500).json({
      error:
        salesResp.error?.message ||
        prescriptionResp.error?.message ||
        alertsResp.error?.message ||
        "Failed to load summary",
    });
  }

  const sales = salesResp.data ?? [];
  const prescriptions = prescriptionResp.data ?? [];
  const alerts = alertsResp.data ?? [];

  const productMap = new Map();
  for (const row of sales) {
    const key = row.product_name || "Unknown";
    productMap.set(key, (productMap.get(key) || 0) + Number(row.quantity || 0));
  }

  const diseaseMap = new Map();
  for (const row of prescriptions) {
    const key = row.disease_label || "Unknown";
    diseaseMap.set(key, (diseaseMap.get(key) || 0) + Number(row.quantity || 0));
  }

  const topProducts = Array.from(productMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDiseases = Array.from(diseaseMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const uniqueDiseaseNames = new Set(
    prescriptions
      .map((row) => String(row.disease_label ?? "").trim())
      .filter(Boolean),
  );

  const salesToday = sales.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0,
  );
  const prescriptionsToday = prescriptions.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0,
  );

  const aiAlertsToday = aiAlertsResp?.alerts?.length
    ? countAlertsSince(aiAlertsResp.alerts, dayStart)
    : 0;

  const alertsToday = Math.max(alerts.length, aiAlertsToday);

  return res.json({
    totals: {
      salesToday,
      prescriptionsToday,
      diseasesSeenToday: uniqueDiseaseNames.size,
      alertsToday,
    },
    topDiseases,
    topProducts,
    source: "supabase",
  });
});

router.get("/risk-map", async (_req, res) => {
  const aiZones = await getAiZones();
  if (aiZones?.points?.length) {
    return res.json({ points: aiZones.points, source: "ai-server" });
  }

  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.json({ points: [], source: "fallback" });
  }

  const [salesResp, prescriptionResp] = await Promise.all([
    supabaseAdmin
      .from("pharmacy_sales_events")
      .select("pincode, latitude, longitude, quantity, location_label")
      .not("pincode", "is", null)
      .limit(2000),
    supabaseAdmin
      .from("prescription_events")
      .select("pincode, latitude, longitude, quantity, location_label")
      .not("pincode", "is", null)
      .limit(2000),
  ]);

  if (salesResp.error || prescriptionResp.error) {
    return res.status(500).json({
      error: salesResp.error?.message || prescriptionResp.error?.message,
    });
  }

  const grouped = new Map();

  for (const row of [
    ...(salesResp.data ?? []),
    ...(prescriptionResp.data ?? []),
  ]) {
    const key = row.pincode || "unknown";
    const item = grouped.get(key) || {
      pincode: key,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationLabel: row.location_label ?? null,
      score: 0,
    };

    item.score += Number(row.quantity || 1);
    if (!item.locationLabel && row.location_label) {
      item.locationLabel = row.location_label;
    }
    if (!item.latitude && row.latitude) {
      item.latitude = row.latitude;
    }
    if (!item.longitude && row.longitude) {
      item.longitude = row.longitude;
    }

    grouped.set(key, item);
  }

  const points = Array.from(grouped.values())
    .map((point) => ({
      ...point,
      riskLevel:
        point.score > 40 ? "high" : point.score > 15 ? "medium" : "low",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 500);

  return res.json({ points, source: "supabase" });
});

router.get("/trend", async (_req, res) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.json({
      points: Array.from({ length: 12 }, (_, index) => ({
        bucketStart: new Date(Date.now() - (11 - index) * 2 * 60 * 60 * 1000).toISOString(),
        sales: 0,
        prescriptions: 0,
        alerts: 0,
        signals: 0,
        total: 0,
      })),
      windowHours: 24,
      bucketHours: 2,
      source: "fallback",
    });
  }

  const windowStart = rollingWindowStartIso(24);
  const [salesResp, prescriptionsResp, alertsResp, signalsResp] = await Promise.all([
    supabaseAdmin
      .from("pharmacy_sales_events")
      .select("quantity, event_time")
      .gte("event_time", windowStart),
    supabaseAdmin
      .from("prescription_events")
      .select("quantity, event_time")
      .gte("event_time", windowStart),
    supabaseAdmin
      .from("alerts")
      .select("id, created_at")
      .gte("created_at", windowStart),
    supabaseAdmin
      .from("community_signals")
      .select("id, reported_at")
      .gte("reported_at", windowStart),
  ]);

  if (salesResp.error || prescriptionsResp.error || alertsResp.error || signalsResp.error) {
    return res.status(500).json({
      error:
        salesResp.error?.message ||
        prescriptionsResp.error?.message ||
        alertsResp.error?.message ||
        signalsResp.error?.message ||
        "Failed to load trend",
    });
  }

  const buckets = createTimeBuckets({ windowHours: 24, bucketHours: 2 });

  for (const row of salesResp.data ?? []) {
    const bucketIndex = buckets.indexFor(row.event_time);
    if (bucketIndex < 0) continue;
    buckets.points[bucketIndex].sales += Number(row.quantity || 0);
  }

  for (const row of prescriptionsResp.data ?? []) {
    const bucketIndex = buckets.indexFor(row.event_time);
    if (bucketIndex < 0) continue;
    buckets.points[bucketIndex].prescriptions += Number(row.quantity || 0);
  }

  for (const row of alertsResp.data ?? []) {
    const bucketIndex = buckets.indexFor(row.created_at);
    if (bucketIndex < 0) continue;
    buckets.points[bucketIndex].alerts += 1;
  }

  for (const row of signalsResp.data ?? []) {
    const bucketIndex = buckets.indexFor(row.reported_at);
    if (bucketIndex < 0) continue;
    buckets.points[bucketIndex].signals += 1;
  }

  const points = buckets.points.map((point) => ({
    ...point,
    total: point.sales + point.prescriptions + point.alerts + point.signals,
  }));

  return res.json({
    points,
    windowHours: buckets.windowHours,
    bucketHours: buckets.bucketHours,
    source: "supabase",
  });
});

export default router;
