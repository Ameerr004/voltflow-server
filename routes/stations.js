import express from "express";
import db from "../db.js";
import adminAuth from "../middleware/adminAuth.js";
const router = express.Router();

// GET localhost:5000/api/stations
router.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM stations ORDER BY id");
  res.json(result.rows);
});

// GET localhost:5000/api/stations/3
router.get("/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM stations WHERE id = $1", [req.params.id]);
  result.rows.length > 0
    ? res.json(result.rows[0])
    : res.status(404).json({ message: "Station not found" });
});

// POST localhost:5000/api/stations   (admin only, header x-role: admin)
// body >> { name, location, connector_type, power_kw, price_per_kwh, status }
router.post("/", adminAuth, async (req, res) => {
  const { name, location, connector_type, power_kw, price_per_kwh, status, image_url } = req.body;
  const result = await db.query(
    `INSERT INTO stations (name, location, connector_type, power_kw, price_per_kwh, status, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, location, connector_type, power_kw, price_per_kwh, status || "online", image_url || null]
  );
  res.status(201).json(result.rows[0]);
});

// PUT localhost:5000/api/stations/3   (admin only)
router.put("/:id", adminAuth, async (req, res) => {
  const { name, location, connector_type, power_kw, price_per_kwh, status, image_url } = req.body;
  const result = await db.query(
    `UPDATE stations
       SET name = $1, location = $2, connector_type = $3, power_kw = $4, price_per_kwh = $5, status = $6, image_url = $7
     WHERE id = $8 RETURNING *`,
    [name, location, connector_type, power_kw, price_per_kwh, status, image_url || null, req.params.id]
  );
  result.rows.length > 0
    ? res.json(result.rows[0])
    : res.status(404).json({ message: "Station not found" });
});

// DELETE localhost:5000/api/stations/3   (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  const result = await db.query("DELETE FROM stations WHERE id = $1 RETURNING *", [req.params.id]);
  result.rows.length > 0
    ? res.json({ deleted: result.rows[0] })
    : res.status(404).json({ message: "Station not found" });
});

export default router;
