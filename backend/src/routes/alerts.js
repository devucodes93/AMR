import { Router } from "express";
import { hasSupabaseConfig, supabase, supabaseAdmin } from "../lib/supabase.js";
import { getAiAlerts, getAiZones } from "../lib/aiClient.js";

const router = Router();

const fallbackAlerts = [
  {
    id: "a-1",
    title: "Red zone threshold crossed in Delhi CRE cluster",
    time: "3 min ago",
  },
  {
    id: "a-2",
    title: "Prescription anomaly detected for carbapenems",
    time: "15 min ago",
  },
  {
    id: "a-3",
    title: "Community respiratory cluster reported in Bengaluru",
    time: "29 min ago",
  },
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildLocationMap(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const pincode = normalizeText(row.pincode || row.zone_key);
    if (!pincode) {
      continue;
    }

    map.set(pincode, {
      district: normalizeText(row.district),
      locationLabel: normalizeText(row.location_label),
    });
  }

  return map;
}

function extractPincodeFromTitle(title) {
  const match = String(title).match(/\b(\d{6})\b/);
  return match?.[1] ?? null;
}

function formatZoneLabel(zoneMeta, pincode) {
  const district = normalizeText(zoneMeta?.district);
  const locationLabel = normalizeText(zoneMeta?.locationLabel);

  if (district && locationLabel) {
    const parts = locationLabel
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const area = parts[0] && parts[0] !== district ? parts[0] : null;
    return area ? `${district} · ${area}` : district;
  }

  if (district) {
    return district;
  }

  if (locationLabel) {
    const parts = locationLabel
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]} · ${parts[0]}`;
    }

    return parts[0] || pincode;
  }

  return pincode;
}

function rewriteAlertTitle(title, zoneMetaMap) {
  const pincode = extractPincodeFromTitle(title);
  if (!pincode) {
    return { title, locationLabel: null };
  }

  const zoneMeta = zoneMetaMap.get(pincode);
  if (!zoneMeta) {
    return { title, locationLabel: null };
  }

  const friendlyLabel = formatZoneLabel(zoneMeta, pincode);
  return {
    title: title.replace(pincode, friendlyLabel),
    locationLabel: friendlyLabel,
  };
}

function rewriteAlertTitleWithLabel(title, explicitLocationLabel) {
  const pincode = extractPincodeFromTitle(title);
  const label = normalizeText(explicitLocationLabel);

  if (!pincode || !label) {
    return { title, locationLabel: null };
  }

  return {
    title: title.replace(pincode, label),
    locationLabel: label,
  };
}

function combineAlertLocation(alert, zoneMetaMap) {
  const base = alert.locationLabel?.trim() ? alert.locationLabel.trim() : null;
  if (base) {
    return base;
  }

  const rewritten = rewriteAlertTitle(alert.title, zoneMetaMap);
  return rewritten.locationLabel;
}

router.get("/", async (_req, res) => {
  const zoneMetaMap = new Map();

  const aiAlerts = await getAiAlerts();
  if (aiAlerts?.alerts?.length) {
    const aiZones = await getAiZones();
    if (aiZones?.points?.length) {
      for (const point of aiZones.points) {
        zoneMetaMap.set(String(point.pincode), {
          district: point.district,
          locationLabel: point.locationLabel,
        });
      }
    }

    return res.json({
      alerts: aiAlerts.alerts.map((alert) => {
        const mapRewritten = rewriteAlertTitle(alert.title, zoneMetaMap);
        const explicitRewritten = rewriteAlertTitleWithLabel(
          alert.title,
          alert.locationLabel,
        );

        const title =
          mapRewritten.title !== alert.title
            ? mapRewritten.title
            : explicitRewritten.title;

        return {
          ...alert,
          title,
          locationLabel: combineAlertLocation(alert, zoneMetaMap),
        };
      }),
      source: "ai-server",
    });
  }

  if (!hasSupabaseConfig || !supabase) {
    return res.json({ alerts: fallbackAlerts, source: "fallback" });
  }

  const { data, error } = await supabase
    .from("alerts")
    .select("id, title, location_label, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.json({ alerts: fallbackAlerts, source: "fallback" });
  }

  const alertRows = data ?? [];

  const { data: zoneRows } = await supabaseAdmin
    .from("ai_zone_risk")
    .select("pincode, zone_key, district, location_label")
    .limit(2000);

  const supabaseZoneMap = buildLocationMap(zoneRows ?? []);

  const alerts = alertRows.map((item) => {
    const fromMap = rewriteAlertTitle(item.title, supabaseZoneMap);
    const fromExplicit = rewriteAlertTitleWithLabel(item.title, item.location_label);
    const locationLabel = item.location_label?.trim()
      ? item.location_label.trim()
      : fromMap.locationLabel;

    return {
      id: String(item.id),
      title: fromMap.title !== item.title ? fromMap.title : fromExplicit.title,
      locationLabel,
      time: item.created_at,
    };
  });

  return res.json({ alerts, source: "supabase" });
});

export default router;
