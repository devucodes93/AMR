import { Router } from "express";
import { hasSupabaseConfig, supabaseAdmin } from "../lib/supabase.js";
import { notifyAiEvent } from "../lib/aiClient.js";

const router = Router();

const fallbackSales = [];

router.get("/", async (_req, res) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.json({ sales: fallbackSales, source: "fallback" });
  }

  const { data, error } = await supabaseAdmin
    .from("pharmacy_sales_events")
    .select("*")
    .order("event_time", { ascending: false })
    .limit(100);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ sales: data ?? [], source: "supabase" });
});

router.post("/", async (req, res) => {
  const {
    pharmacyUserId,
    facilityId,
    productName,
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

  if (!productName || !quantity) {
    return res
      .status(400)
      .json({ error: "productName and quantity are required" });
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

  const { error } = await supabaseAdmin.from("pharmacy_sales_events").insert({
    pharmacy_user_id: pharmacyUserId ?? null,
    facility_id: safeFacilityId ?? null,
    product_name: productName,
    antibiotic_name: antibioticName ?? null,
    quantity: Number(quantity),
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

  await notifyAiEvent("pharmacy", {
    pharmacyUserId,
    facilityId,
    productName,
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
