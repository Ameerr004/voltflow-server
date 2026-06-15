import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import stationRoutes from "./routes/stations.js";
import bookingRoutes from "./routes/bookings.js";
import slotRoutes from "./routes/slots.js";
import db from "./db.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// localhost:5000
app.use("/api/auth", authRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/slots", slotRoutes);

app.get("/", (req, res) => {
  res.send("⚡ VoltFlow API (PostgreSQL) is running");
});

db.connect().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
