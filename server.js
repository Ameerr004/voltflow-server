import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import stationRoutes from "./routes/stations.js";
import bookingRoutes from "./routes/bookings.js";
import slotRoutes from "./routes/slots.js";
import db, { initSchema } from "./db.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" })); // larger limit so base64 station photos fit
app.use(morgan("dev"));

// localhost:5000
app.use("/api/auth", authRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/slots", slotRoutes);

app.get("/", (req, res) => {
  res.send("⚡ VoltFlow API (PostgreSQL) is running");
});

// 404 — no route matched
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler — Express 5 forwards rejected async-handler promises
// here automatically, so a DB failure returns clean JSON instead of crashing.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("API error:", err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

// Start listening immediately so the host (Render) detects the open port,
// then connect to the database in the background and log the result.
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

db.connect()
  .then(async () => {
    console.log("✅ Database connected");
    await initSchema(); // auto-create tables + seed on first run
  })
  .catch((err) => console.error("❌ Database setup failed:", err.message));
