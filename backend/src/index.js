import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import communityRoutes from "./routes/community.js";
import alertsRoutes from "./routes/alerts.js";
import escalationsRoutes from "./routes/escalations.js";
import doctorEventsRoutes from "./routes/doctorEvents.js";
import pharmacySalesRoutes from "./routes/pharmacySales.js";
import dashboardRoutes from "./routes/dashboard.js";
import { hasSupabaseConfig } from "./lib/supabase.js";
import http from "node:http";

const app = express();
const requestedPort = Number(process.env.PORT || 4000);
//allow CORS from any origin for development purposes. In production, this should be restricted to the frontend domain.
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "amr-backend",
    supabaseConfigured: hasSupabaseConfig,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/community-signals", communityRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/escalations", escalationsRoutes);
app.use("/api/doctor-events", doctorEventsRoutes);
app.use("/api/pharmacy-sales", pharmacySalesRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err?.message ?? "Internal server error" });
});

function startServer(port) {
  const server = http.createServer(app);

  server.on("listening", () => {
    console.log(`AMR backend running on http://localhost:${port}`);

    if (port !== requestedPort) {
      console.log(
        `Requested port ${requestedPort} was busy. Using ${port} instead.`,
      );
    }
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other process and restart backend.`,
      );
      process.exit(1);
    }
    console.error("Failed to start backend server:", error);
    process.exit(1);
  });

  server.listen(port);
}

startServer(requestedPort);
