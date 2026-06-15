import express from "express";
import db from "../db.js";
const router = express.Router();

// localhost:5000/api/auth/signup
// POST  body >> { email, password }
// Self-service signups are ALWAYS regular users. Admin accounts are
// provisioned directly in the database (see schema.sql) and cannot be created
// through the public signup form.
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const exists = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  if (exists.rows.length > 0) return res.status(400).json({ message: "User already exists" });

  const result = await db.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING id, email, role",
    [email, password]
  );
  res.status(201).json({ user: result.rows[0] });
});

// localhost:5000/api/auth/login
// POST  body >> { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await db.query(
    "SELECT id, email, role FROM users WHERE email = $1 AND password = $2",
    [email, password]
  );
  if (result.rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });
  res.json({ user: result.rows[0] });
});

export default router;
