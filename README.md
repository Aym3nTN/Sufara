# Sufara — سفراء

**Discover. Plan. Journey Through Islamic Heritage.**

Sufara is an Islamic heritage travel companion and intelligent ziyarat planner.
It is built around one question:

> *"I just arrived in Madinah. I have four hours. What can I visit?"*

Sufara answers with a real, time-aware itinerary — ordered stops, honest travel
times, realistic visit durations, and slack left over so a small delay doesn't
wreck the day.

```
YOUR 4-HOUR MADINAH ITINERARY     Total 3h 27m · Travel 47m · Visit 2h 40m · Buffer 33m

  Centre of Madinah
   ↓ 6 min drive · 460 m
  1. Al-Masjid an-Nabawi      visit 1h       arrive 11:05
   ↓ 6 min drive · 390 m
  2. Jannat al-Baqi           visit 25 min   arrive 12:11
   ↓ 13 min drive · 4.1 km
  3. Quba Mosque              visit 45 min   arrive 12:49
   ↓ 22 min drive · 8.6 km
  4. Masjid al-Qiblatayn      visit 30 min   arrive 13:56
```

That output is generated, not mocked.

---

## What's here

| Path | Contents |
| --- | --- |
| `api/` | Node + TypeScript + Express + Prisma API: auth, catalogue, planner, itineraries, admin |
| `mobile/` | Expo (React Native) app: traveller experience + admin console, iOS/Android/web |
| `docs/ARCHITECTURE.md` | Stack decisions, database schema, planner design, phases |
| `docs/DEPLOYMENT.md` | Render + Neon + Cloudflare R2 deployment, env var reference |
| `docs/MOBILE_BUILDS.md` | Expo Go, EAS cloud APK, and local Android builds |

## Running it

Requires Node 20+.

```bash
# 1. Install everything and create a seeded SQLite database
npm run setup

# 2. Start the API (http://localhost:4000)
npm run api

# 3. In a second terminal, start the app
npm run mobile        # press i / a / w, or scan the QR code
npm run mobile:web    # or go straight to the browser
```

The app resolves the API automatically: `EXPO_PUBLIC_API_URL` if set, otherwise
port 4000 on the Metro host — so opening the QR code on a phone works with no
configuration.

To get it onto a phone as an installable app, see
[`docs/MOBILE_BUILDS.md`](docs/MOBILE_BUILDS.md). To deploy the API, see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Seeded accounts

`npm run setup` creates two accounts — `traveler@sufara.app` (USER) and
`admin@sufara.app` (ADMIN) — and **prints their password once**:

```
Created admin@sufara.app and traveler@sufara.app with a generated password:

    kQ8mZ2vTx1LraA1!

Store it now — it is not written anywhere. Set SEED_PASSWORD to choose your own.
```

To pick your own instead, put `SEED_PASSWORD=…` in `api/.env` before seeding.
There is deliberately no default: a hardcoded seed password would be a live
credential for every deployment, published in this repository. Re-running the
seed never resets a password that already exists.

Seed content: **46 places** across **6 cities** in **5 countries** — Madinah,
Makkah, Jerusalem, Istanbul, Cairo and Fez — each with a description, an
estimated visit duration and an admin-managed importance score.

### Checks

```bash
npm test         # 67 API tests (planner invariants, auth, RBAC, deploy config, full user flow)
npm run typecheck
```

---

## The three planning modes

| Mode | The traveller says | Endpoint |
| --- | --- | --- |
| **A — Plan for me** | "Madinah, 4 hours, Islamic history" | `POST /planner/generate` |
| **B — I choose the places** | "These six places — best order?" | `POST /planner/optimize` |
| **C — Explore everything** | "Madinah, full day" | `POST /planner/generate` |

Editing an itinerary uses `POST /planner/preview`, which times the traveller's
exact ordering **without** reshuffling it, so the app can warn *"this runs about
35 minutes longer than the time you have"* instead of quietly rearranging their
plan.

## How the planner decides

`api/src/services/planner/` is pure TypeScript with no database or network
access — it takes candidate places and a routing provider and returns a plan.

1. **Candidates** — active places in the city, filtered for opening-hours
   feasibility at the projected arrival time.
2. **Score** — significance (an admin-managed `importanceScore`, curved so
   first-rank sites genuinely dominate) × interest match. Interests *bias*
   scoring, they never hard-filter, so a narrow selection can't return an empty
   itinerary in a city full of significant sites.
3. **Build** — greedy insertion against a budget of `available − buffer`,
   choosing the stop with the best score per *marginal* minute. The time penalty
   is deliberately sub-linear, so a more significant site a few minutes farther
   away beats a trivial one next door.
4. **Improve** — 2-opt on the stop order to cut travel time without changing
   which places are visited.
5. **Verify** — recompute every leg, drop anything that breaches the budget, and
   re-check opening hours against real projected arrivals.

Two invariants are enforced in code and covered by tests:

- **A plan never exceeds the traveller's available time.** The only exception is
  Mode B, where the traveller forced specific places in — and then the overrun is
  *reported*, never hidden.
- **The buffer is never zero.** `clamp(8% of available, 10 min, 30 min)`, capped
  at a fifth of the window.

## Swappable by design

| Concern | Abstraction | Today | Ready for |
| --- | --- | --- | --- |
| Travel times | `RoutingProvider` | offline estimator (no key, no quota) | OSRM adapter included; ORS / Mapbox / Google |
| Maps | `<MapCanvas>` | `react-native-maps` on device, plan view on web | Mapbox, MapLibre |
| Images | `StorageProvider` | local disk + `sharp` re-encode | S3 / R2 / Cloudinary |
| Database | Prisma | SQLite | PostgreSQL (no model changes) |

Screens never import a map SDK, and the planner never learns which routing
provider is in use.

## Security posture

- JWT access tokens (15 min) with **rotating, single-use** refresh tokens stored
  hashed — a leaked refresh token is revocable and its reuse is detectable.
- Every admin route passes `requireAuth → requireRole('ADMIN')` **on the server**.
  Hiding the admin UI is treated as cosmetic; the test suite asserts that an
  authenticated ordinary traveller gets `403` on every admin route.
- Self-registration cannot grant a role — a request asking for `ADMIN` is ignored.
- Zod validates every request body and query at the edge.
- Uploads are checked by magic bytes (not the client's MIME type), size-capped,
  and re-encoded, which also strips EXIF/GPS metadata.
- Changing a password revokes every existing session; disabling a user cuts
  theirs immediately.
- `Country → City → Place` is enforced by foreign keys, and the API rejects a
  city that doesn't belong to the submitted country.

## A note on photographs

No stock imagery is used. Places without a real photograph get a deterministic
eight-point star (girih) pattern generated from their identity and tinted by
category — so the UI looks intentional without a placeholder image implying it
depicts a specific sacred site. Administrators can upload real photographs, and
they take over wherever they exist.

## Deliberately not built

Reviews and ratings, audio guides, AI historical explanations, prayer-time-aware
itineraries, multi-day trips, halal services, offline maps, public transport and
social sharing are all out of scope for this MVP. The schema and service
boundaries leave room for them —
see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — without carrying their cost
now.
