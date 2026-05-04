import { Router } from "express";
import { hasSupabaseConfig, supabaseAdmin } from "../lib/supabase.js";
import { notifyAiEvent } from "../lib/aiClient.js";

const router = Router();

const fallbackDoctorEvents = [];

router.get("/", async (_req, res) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.json({ events: fallbackDoctorEvents, source: "fallback" });
  }

  const { data, error } = await supabaseAdmin
    .from("prescription_events")
    .select("*")
    .order("event_time", { ascending: false })
    .limit(100);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ events: data ?? [], source: "supabase" });
});

router.post("/", async (req, res) => {
  const {
    doctorUserId,
    facilityId,
    diseaseLabel,
    antibioticName,
    quantity,
    eventTime,
    district,
    pincode,
    latitude,
    longitude,
    locationLabel,
    locationDetails,
  } = req.body;

  if (!diseaseLabel) {
    return res.status(400).json({ error: "diseaseLabel is required" });
  }

  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.status(202).json({ accepted: true, mode: "noop" });
  }
  // Validate facilityId exists to avoid foreign-key violations
  let safeFacilityId = null;
  if (facilityId) {
    const { data: facilityData, error: facilityError } = await supabaseAdmin
      .from("facilities")
      .select("id")
      .eq("id", facilityId)
      .limit(1)
      .maybeSingle();

    if (!facilityError && facilityData) {
      safeFacilityId = facilityData.id;
    }
  }

  const { error } = await supabaseAdmin.from("prescription_events").insert({
    doctor_user_id: doctorUserId ?? null,
    facility_id: safeFacilityId ?? null,
    disease_label: diseaseLabel,
    antibiotic_name: antibioticName ?? null,
    quantity: Number(quantity || 1),
    event_time: eventTime ?? new Date().toISOString(),
    district: district ?? null,
    pincode: pincode ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    location_label: locationLabel ?? null,
    location_details: locationDetails ?? null,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await notifyAiEvent("doctor", {
    doctorUserId,
    facilityId,
    diseaseLabel,
    antibioticName,
    quantity,
    eventTime,
    district,
    pincode,
    latitude,
    longitude,
    locationLabel,
    locationDetails,
  });

  return res.status(201).json({ accepted: true, mode: "supabase" });
});

export default router;
