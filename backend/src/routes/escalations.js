import { Router } from "express";
import { hasSupabaseConfig, supabaseAdmin } from "../lib/supabase.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message, zoneId, zoneLabel, timestamp, location } = req.body;

  if (!message || !zoneId || !zoneLabel || !timestamp || !location) {
    return res.status(400).json({ error: "Invalid escalation payload" });
  }

  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.status(202).json({
      accepted: true,
      mode: "noop",
      note: "Supabase not configured yet",
    });
  }

  const { error } = await supabaseAdmin.from("escalations").insert({
    message,
    zone_id: zoneId,
    zone_label: zoneLabel,
    created_at: timestamp,
    latitude: location.latitude,
    longitude: location.longitude,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ accepted: true, mode: "supabase" });
});

export default router;
