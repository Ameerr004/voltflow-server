# voltflow-server

Express + PostgreSQL API for VoltFlow. Same architecture as the course reference `05-FullStack/store-app/store-server` (ESM Express 5, raw `pg` queries, `routes/` + `middleware/`, `x-role` admin gate).

## Setup

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL
psql "$DATABASE_URL" -f schema.sql
npm start                     # http://localhost:5000
```

## Endpoints

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/signup` | — | `{ email, password, role }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| GET | `/api/stations` | — | — |
| GET | `/api/stations/:id` | — | — |
| POST | `/api/stations` | `x-role: admin` | `{ name, location, connector_type, power_kw, price_per_kwh, status }` |
| PUT | `/api/stations/:id` | `x-role: admin` | same as POST |
| DELETE | `/api/stations/:id` | `x-role: admin` | — |
| GET | `/api/bookings` | `x-role: admin` | — |
| GET | `/api/bookings/:email` | — | — |
| POST | `/api/bookings` | — | `{ email, station_id, slot, booking_date }` |
| DELETE | `/api/bookings/:id` | — | — |

Seeded logins: `admin@voltflow.com / admin123` (admin), `driver@voltflow.com / driver123` (user).
