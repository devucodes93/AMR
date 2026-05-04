import { Router } from "express";
import { hasSupabaseConfig, supabase } from "../lib/supabase.js";
import { notifyAiEvent } from "../lib/aiClient.js";

const router = Router();

const fallbackSignals = [
  {
    id: "1",
    area: "Delhi - 110001",
    symptoms: "Persistent fever and non-responsive UTI",
    intensity: "High",
    reportedAt: "5 min ago",
  },
  {
    id: "2",
    area: "Mumbai - 400001",
    symptoms: "Skin infection not improving after common antibiotics",
    intensity: "Medium",
    reportedAt: "18 min ago",
  },
  {
    id: "3",
    area: "Bengaluru - 560001",
    symptoms: "Respiratory cases with delayed recovery",
    intensity: "Low",
    reportedAt: "42 min ago",
  },
];

router.post("/", async (req, res) => {
  const {
    area,
    symptoms,
    intensity,
    district,
    pincode,
    latitude,
    longitude,
    reportedAt,
    locationLabel,
    locationDetails,
  } = req.body;

  if (!area || !symptoms || !intensity) {
    return res
      .status(400)
      .json({ error: "area, symptoms and intensity are required" });
  }

  if (!hasSupabaseConfig || !supabase) {
    return res.status(202).json({ accepted: true, mode: "noop" });
  }

  const { error } = await supabase.from("community_signals").insert({
    area,
    symptoms,
    intensity,
    district: district ?? null,
    pincode: pincode ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    reported_at: reportedAt ?? new Date().toISOString(),
    location_label: locationLabel ?? null,
    location_details: locationDetails ?? null,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await notifyAiEvent("community", {
    area,
    symptoms,
    intensity,
    district,
    pincode,
    latitude,
    longitude,
    reportedAt,
    locationLabel,
    locationDetails,
  });

  return res.status(201).json({ accepted: true, mode: "supabase" });
});

router.get("/", async (_req, res) => {
  if (!hasSupabaseConfig || !supabase) {
    return res.json({ signals: fallbackSignals, source: "fallback" });
  }

  const { data, error } = await supabase
    .from("community_signals")
    .select("id, area, symptoms, intensity, reported_at")
    .order("reported_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.json({ signals: fallbackSignals, source: "fallback" });
  }

  const signals = (data ?? []).map((item) => ({
    id: String(item.id),
    area: item.area,
    symptoms: item.symptoms,
    intensity: item.intensity,
    reportedAt: item.reported_at,
  }));

  return res.json({ signals, source: "supabase" });
});

export default router;
