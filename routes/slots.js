import express from "express";
import db from "../db.js";
import adminAuth from "../middleware/adminAuth.js";
const router = express.Router();

// Standard windows auto-generated for any current/future day so every day has
// a baseline grid. Admins can add extra custom timeslots on top.
const DEFAULT_WINDOWS = [
  ["08:00", "10:00"],
  ["10:00", "12:00"],
  ["12:00", "14:00"],
  ["14:00", "16:00"],
  ["16:00", "18:00"],
  ["18:00", "20:00"],
];

async function ensureSlots(stationId, date) {
  for (const [start, end] of DEFAULT_WINDOWS) {
    await db.query(
      `INSERT INTO slots (station_id, slot_date, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (station_id, slot_date, start_time) DO NOTHING`,
      [stationId, date, start, end]
    );
  }
}

// True if [start, end) overlaps any existing slot for the same station + day.
// Two ranges overlap when existing.start < new.end AND existing.end > new.start.
// Pass excludeId when editing so a slot doesn't clash with itself.
async function hasOverlap(stationId, date, start, end, excludeId = null) {
  const params = [stationId, date, start, end];
  let sql = `SELECT 1 FROM slots
               WHERE station_id = $1 AND slot_date = $2
                 AND start_time < $4 AND end_time > $3`;
  if (excludeId != null) {
    params.push(excludeId);
    sql += " AND id <> $5";
  }
  const result = await db.query(sql + " LIMIT 1", params);
  return result.rows.length > 0;
}

// GET /api/slots?station_id=1&date=2026-06-03
// Past days return nothing (registrations for finished days disappear).
router.get("/", async (req, res) => {
  const { station_id, date } = req.query;
  if (!station_id || !date) return res.status(400).json({ message: "station_id and date are required" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(date) < today) return res.json([]);

  await ensureSlots(station_id, date);
  const result = await db.query(
    "SELECT * FROM slots WHERE station_id = $1 AND slot_date = $2 ORDER BY start_time",
    [station_id, date]
  );
  res.json(result.rows);
});

// GET /api/slots/windows?date=YYYY-MM-DD
// The distinct time windows that actually exist in the DB for that day (the
// auto-generated defaults plus any custom slots admins added). Falls back to
// the default windows when the day has no slots generated yet.
router.get("/windows", async (req, res) => {
  const { date } = req.query;
  let rows = [];
  if (date) {
    const r = await db.query(
      "SELECT DISTINCT start_time, end_time FROM slots WHERE slot_date = $1 ORDER BY start_time",
      [date]
    );
    rows = r.rows;
  }
  if (rows.length === 0) {
    rows = DEFAULT_WINDOWS.map(([start_time, end_time]) => ({ start_time, end_time }));
  }
  res.json(rows);
});

// POST /api/slots  (admin) — add a custom timeslot for a given day
// body >> { station_id, slot_date, start_time, end_time }
router.post("/", adminAuth, async (req, res) => {
  const { station_id, slot_date, start_time, end_time } = req.body;
  if (!station_id || !slot_date || !start_time || !end_time)
    return res.status(400).json({ message: "All slot fields are required" });
  if (start_time >= end_time)
    return res.status(400).json({ message: "End time must be after start time" });
  if (await hasOverlap(station_id, slot_date, start_time, end_time))
    return res.status(409).json({ message: "That time overlaps an existing slot" });
  try {
    const result = await db.query(
      `INSERT INTO slots (station_id, slot_date, start_time, end_time)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [station_id, slot_date, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(400).json({ message: "A slot already exists at that start time" });
  }
});

// PUT /api/slots/:id  (admin) — either edit the slot's time window, or
// block / unblock it.
// body >> { start_time, end_time }  ← edit time (overlap-checked)
//      or { status: 'blocked' | 'available' }  ← block / unblock
router.put("/:id", adminAuth, async (req, res) => {
  const { status, start_time, end_time } = req.body;

  // Edit the time window
  if (start_time && end_time) {
    if (start_time >= end_time)
      return res.status(400).json({ message: "End time must be after start time" });

    const found = await db.query("SELECT * FROM slots WHERE id = $1", [req.params.id]);
    if (!found.rows.length) return res.status(404).json({ message: "Slot not found" });
    const slot = found.rows[0];

    if (await hasOverlap(slot.station_id, slot.slot_date, start_time, end_time, Number(req.params.id)))
      return res.status(409).json({ message: "That time overlaps an existing slot" });

    const updated = await db.query(
      "UPDATE slots SET start_time = $1, end_time = $2 WHERE id = $3 RETURNING *",
      [start_time, end_time, req.params.id]
    );
    return res.json(updated.rows[0]);
  }

  // Block / unblock
  const result = await db.query(
    "UPDATE slots SET status = $1, booked_by = NULL WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );
  result.rows.length
    ? res.json(result.rows[0])
    : res.status(404).json({ message: "Slot not found" });
});

// DELETE /api/slots/:id  (admin)
router.delete("/:id", adminAuth, async (req, res) => {
  const result = await db.query("DELETE FROM slots WHERE id = $1 RETURNING *", [req.params.id]);
  result.rows.length
    ? res.json({ deleted: result.rows[0] })
    : res.status(404).json({ message: "Slot not found" });
});

// POST /api/slots/:id/book — a logged-in user books an available slot
// body >> { email }
router.post("/:id/book", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(401).json({ message: "You must be logged in to book a slot" });

  const found = await db.query("SELECT * FROM slots WHERE id = $1", [req.params.id]);
  if (found.rows.length === 0) return res.status(404).json({ message: "Slot not found" });
  if (found.rows[0].status !== "available")
    return res.status(409).json({ message: "Slot is no longer available" });

  const result = await db.query(
    "UPDATE slots SET status = 'booked', booked_by = $1 WHERE id = $2 RETURNING *",
    [email, req.params.id]
  );
  res.status(201).json(result.rows[0]);
});

export default router;
