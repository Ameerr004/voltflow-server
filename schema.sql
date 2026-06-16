-- VoltFlow schema (PostgreSQL) — mirrors the reference store-server style.
-- Run once:  psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,         -- NOTE: plaintext, matching the educational reference. Hash in production.
  role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  connector_type TEXT NOT NULL,   -- e.g. 'CCS2', 'CHAdeMO', 'Type 2'
  power_kw INTEGER NOT NULL,      -- e.g. 50, 150, 350
  price_per_kwh NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',  -- 'online' | 'offline'
  image_url TEXT                  -- station photo (nullable; UI falls back to a default)
);

-- Migration for databases created before image_url existed:
ALTER TABLE stations ADD COLUMN IF NOT EXISTS image_url TEXT;

-- A slot is a bookable window for a station on a specific day. It is the single
-- source of truth: a "booking" is simply a slot with status='booked'.
CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TEXT NOT NULL,       -- '08:00'
  end_time TEXT NOT NULL,         -- '10:00'
  status TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'booked' | 'blocked'
  booked_by TEXT REFERENCES users(email) ON DELETE SET NULL,  -- FK: the user who booked
  UNIQUE (station_id, slot_date, start_time)
);

-- Migration for databases created before booked_by was a foreign key:
-- first clear any emails that don't exist in users, then add the FK constraint.
UPDATE slots SET booked_by = NULL
  WHERE booked_by IS NOT NULL AND booked_by NOT IN (SELECT email FROM users);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'slots_booked_by_fkey') THEN
    ALTER TABLE slots
      ADD CONSTRAINT slots_booked_by_fkey
      FOREIGN KEY (booked_by) REFERENCES users(email) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed data so the UI has something to show
-- The single admin account. Admins are provisioned here, never via signup.
INSERT INTO users (email, password, role) VALUES
  ('marmashameer0@gmail.com', '1234', 'admin'),
  ('driver@voltflow.com', 'driver123', 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO stations (name, location, connector_type, power_kw, price_per_kwh, status, image_url) VALUES
  ('Downtown Hub - Alpha', 'Seattle, WA', 'CCS2', 350, 0.45, 'online', 'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=900&q=80'),
  ('Metro Transit Depot', 'Bellevue, WA', 'CCS2', 150, 0.40, 'online', 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=900&q=80'),
  ('Highway 99 Rest Stop', 'Everett, WA', 'CCS2', 50, 0.35, 'offline', 'https://images.unsplash.com/photo-1558425025-8b9b5fcdb8a5?auto=format&fit=crop&w=900&q=80');
