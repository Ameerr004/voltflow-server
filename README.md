# VoltFlow Backend (Node.js + Express + PostgreSQL)

This folder contains the **Node.js (Express 5)** REST API for **VoltFlow**, an EV charging network platform.

Key goals
- Simple REST API (JSON)
- **PostgreSQL** for persistence (with an in-memory `pg-mem` fallback when no `DATABASE_URL` is set)
- Role-based access: **admin** vs **user (driver)**, enforced by an `x-role` header gate
- A "booking" is modelled as a **slot** with `status = 'booked'` — slots are the single source of truth
- Bookings are **time-aware**: a reservation automatically moves from *active* to *history* once its slot has ended

## Prerequisites

- Node.js (LTS recommended)
- PostgreSQL 16+

## Install

```bash
npm install
```

## Environment

Create a `.env` file in this backend folder (same level as `server.js`) — see `.env.example`:

```env
PORT=5001
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/voltflow
```

> The API runs on port **5001** (the client points at `http://localhost:5001/api`).

## Database setup

1) Create the database:

```sql
CREATE DATABASE voltflow;
```

2) Run the schema (creates tables + seed data):

```bash
psql "$DATABASE_URL" -f schema.sql
```

### What schema.sql does

`schema.sql` creates the following tables:

- `users` — `id, email, password, role`
- `stations` — `id, name, location, connector_type, power_kw, price_per_kwh, status, image_url`
- `slots` — `id, station_id (FK → stations.id, ON DELETE CASCADE), slot_date, start_time, end_time, status, booked_by (FK → users.email, ON DELETE SET NULL)` with `UNIQUE (station_id, slot_date, start_time)`

It also seeds:
- **One admin account** — `marmashameer0@gmail.com` / `1234` (role `admin`)
- A demo driver — `driver@voltflow.com` / `driver123` (role `user`)
- Three example stations with photos

## Run the server

```bash
npm start
```

Server runs on:
- `http://localhost:5001`
- Base API: `http://localhost:5001/api`

## Project structure

```
voltflow-server/
  server.js                 # App entry: CORS, JSON, morgan, route mounts
  db.js                     # PostgreSQL pool (pg) with pg-mem fallback
  schema.sql                # Tables + seed data
  middleware/
    adminAuth.js            # x-role: admin gate for write endpoints
  routes/
    auth.js                 # Signup / login
    stations.js             # Stations CRUD
    slots.js                # Slot grid, windows, block/edit/delete, booking
    bookings.js             # Active + history bookings (user & admin), cancel
```

## API endpoints

### Status
- `GET /` → `⚡ VoltFlow API (PostgreSQL) is running`

### Auth
- `POST /api/auth/signup` — body `{ email, password }`. Role is **always `user`** (server-enforced). Returns `{ user }`.
- `POST /api/auth/login` — body `{ email, password }`. Returns `{ user: { id, email, role } }`.

### Stations
| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/stations` | — | — |
| GET | `/api/stations/:id` | — | — |
| POST | `/api/stations` | `x-role: admin` | `{ name, location, connector_type, power_kw, price_per_kwh, status?, image_url? }` |
| PUT | `/api/stations/:id` | `x-role: admin` | same as POST |
| DELETE | `/api/stations/:id` | `x-role: admin` | — |

### Slots
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/slots?station_id=&date=` | — | Availability grid for a station/day (past days return `[]`) |
| GET | `/api/slots/windows?date=` | — | Distinct time-windows that exist for that day (from the DB) |
| POST | `/api/slots` | `x-role: admin` | Add a custom timeslot (overlap-validated) |
| PUT | `/api/slots/:id` | `x-role: admin` | `{ status }` to block/unblock **or** `{ start_time, end_time }` to edit (overlap-validated) |
| DELETE | `/api/slots/:id` | `x-role: admin` | Delete a timeslot |
| POST | `/api/slots/:id/book` | — | Book a slot, body `{ email }` |

### Bookings (a booking = a booked slot)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/bookings` | `x-role: admin` | All **upcoming** bookings |
| GET | `/api/bookings/history` | `x-role: admin` | All **past** bookings (every driver) |
| GET | `/api/bookings/:email` | — | A driver's **upcoming** bookings |
| GET | `/api/bookings/:email/history` | — | A driver's **past** bookings |
| DELETE | `/api/bookings/:id` | — | Cancel a booking (frees the slot) |

## Quick verification (recommended)

1) Run `schema.sql`
2) Start the backend (`npm start`)
3) Start the frontend
4) Log in as admin: `marmashameer0@gmail.com / 1234`
5) Register a station and add/edit timeslots
6) Sign up a driver, then book a slot
7) After the slot's time passes, confirm it moves into **History** (driver and admin views)
