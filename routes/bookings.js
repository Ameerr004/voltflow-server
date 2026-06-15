import express from "express";
import db from "../db.js";
import adminAuth from "../middleware/adminAuth.js";
const router = express.Router();

// A "booking" is a slot with status='booked'.
//  - ACTIVE  = upcoming: the slot's day/time has not finished yet.
//  - HISTORY = past: the slot's day/time is over (the charge already happened).
// A finished booking automatically drops out of the active lists and shows up
// in history instead.

const SELECT = `SELECT s.*, st.name AS station_name, st.location
                  FROM slots s
                  JOIN stations st ON s.station_id = st.id`;

// Current local time as 'HH:MM' so we can compare against slot end_time.
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Not finished yet: a future day, or today but ending after the current time.
const ACTIVE_COND = "(s.slot_date > CURRENT_DATE OR (s.slot_date = CURRENT_DATE AND s.end_time > $NOW))";
// Finished: a past day, or today but already ended.
const PAST_COND = "(s.slot_date < CURRENT_DATE OR (s.slot_date = CURRENT_DATE AND s.end_time <= $NOW))";

/* ---------------- ACTIVE (upcoming) ---------------- */

// GET /api/bookings   (admin) — every upcoming booked slot
router.get("/", adminAuth, async (req, res) => {
  const result = await db.query(
    `${SELECT} WHERE s.status = 'booked' AND ${ACTIVE_COND.replace("$NOW", "$1")}
      ORDER BY s.slot_date, s.start_time`,
    [nowHHMM()]
  );
  res.json(result.rows);
});

/* ---------------- HISTORY (past) ---------------- */

// GET /api/bookings/history   (admin) — all users' finished bookings
// (declared before /:email so "history" isn't read as an email)
router.get("/history", adminAuth, async (req, res) => {
  const result = await db.query(
    `${SELECT} WHERE s.status = 'booked' AND ${PAST_COND.replace("$NOW", "$1")}
      ORDER BY s.slot_date DESC, s.start_time DESC`,
    [nowHHMM()]
  );
  res.json(result.rows);
});

// GET /api/bookings/:email/history — a single user's finished bookings
router.get("/:email/history", async (req, res) => {
  const result = await db.query(
    `${SELECT} WHERE s.booked_by = $1 AND s.status = 'booked' AND ${PAST_COND.replace("$NOW", "$2")}
      ORDER BY s.slot_date DESC, s.start_time DESC`,
    [req.params.email, nowHHMM()]
  );
  res.json(result.rows);
});

// GET /api/bookings/:email — a single user's upcoming bookings
router.get("/:email", async (req, res) => {
  const result = await db.query(
    `${SELECT} WHERE s.booked_by = $1 AND s.status = 'booked' AND ${ACTIVE_COND.replace("$NOW", "$2")}
      ORDER BY s.slot_date, s.start_time`,
    [req.params.email, nowHHMM()]
  );
  res.json(result.rows);
});

// DELETE /api/bookings/:id — cancel a booking (frees the slot)
router.delete("/:id", async (req, res) => {
  const result = await db.query(
    "UPDATE slots SET status = 'available', booked_by = NULL WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  result.rows.length
    ? res.json({ cancelled: result.rows[0] })
    : res.status(404).json({ message: "Booking not found" });
});

export default router;
