# Sufara — Technical Architecture

> Sufara (سفراء / سفر) — *Discover. Plan. Journey Through Islamic Heritage.*
>
> An Islamic heritage travel companion and intelligent ziyarat/visit planner.

The repository was empty at the start of this work (a single `README.md`), so the
stack below is a greenfield recommendation, chosen for MVP velocity, low
operating cost, and the ability to swap out every third‑party dependency later.

---

## 1. Recommended mobile framework

**React Native via Expo (SDK 52+), TypeScript, Expo Router.**

| Why | Detail |
| --- | --- |
| One codebase | iOS + Android, plus a **web** target that we actively use for automated UI verification in CI/containers. |
| Native modules we need | `expo-location` (GPS/permissions), `react-native-maps` (Google/Apple maps), `expo-image`, `expo-secure-store` (token storage). |
| File-based routing | Expo Router mirrors the screen structure in section 11 almost 1:1 and gives deep links for free. |
| Escape hatch | Expo prebuild → bare React Native if a native dependency ever demands it. |

## 2. Backend technology

**Node.js 22 + TypeScript + Express + Zod.**

- Same language as the mobile client → shared domain vocabulary, one hiring pool.
- The Smart Visit Planner is pure, dependency-free TypeScript, so the identical
  module can later run on-device for offline planning.
- Zod validates *every* request body/query at the edge and produces the
  TypeScript types used by handlers.

## 3. Database

**PostgreSQL in production, SQLite for local dev/tests — accessed through Prisma.**

- Prisma gives typed queries + versioned migrations.
- SQLite keeps the dev/test loop instant and hermetic (each test run gets a
  throwaway database file). No enums or scalar arrays are used anywhere in the
  schema, so the same models migrate to PostgreSQL by changing one `provider`
  line; PostGIS can be added later for radius queries.

## 4. Authentication

**Stateless JWT access tokens (15 min) + rotating refresh tokens (30 d)**,
`bcryptjs` password hashing, server-side RBAC.

- Refresh tokens are stored **hashed** and are single-use (rotation + reuse
  detection), so a stolen refresh token is revocable.
- Roles: `USER`, `ADMIN`. Every admin route passes through
  `requireAuth` → `requireRole('ADMIN')` **on the server**. Hiding admin UI is
  treated as cosmetic only.
- Password reset issues a hashed, single-use, 1‑hour token.

## 5. Map provider

Abstracted behind a `<MapView>` component contract in the mobile app:

- **native:** `react-native-maps` (Google Maps on Android, Apple Maps on iOS).
- **web:** an equivalent renderer used for verification/screenshots.

Screens never import a map SDK directly — they render `MapView` /
`MapMarker` / `MapPolyline` from `src/components/map`. Swapping to Mapbox or
MapLibre means replacing that folder only.

## 6. Routing provider

Abstracted behind `RoutingProvider` (`api/src/services/routing/`):

```ts
getTravelLeg(origin, destination, mode)        // one leg
getTravelMatrix(points, mode)                  // n×n legs
getRouteGeometry(origin, waypoints, mode)      // polyline for the map
```

- **MVP implementation:** `HaversineRoutingProvider` — great-circle distance ×
  a mode-specific urban detour factor ÷ a mode-specific speed, plus a fixed
  per-stop overhead (parking/approach). No API key, no rate limit, good enough
  to prove the product.
- **Ready to drop in:** OSRM / OpenRouteService / Mapbox / Google. The provider
  is selected by `ROUTING_PROVIDER` at boot, and the matrix call is the only
  hot path, so provider cost is predictable.
- Chosen provider should be decided on cost, quota, coverage (Saudi Arabia,
  Türkiye, Palestine, Egypt) and route quality — not baked into the planner.

## 7. Image storage

Abstracted behind `StorageProvider` (`api/src/services/storage/`):
`put(key, buffer, contentType)`, `remove(key)`, `urlFor(key)`.

- **MVP:** `LocalDiskStorage` under `api/uploads`, served read-only.
- **Later:** S3/R2/Cloudinary adapter — no call-site changes.
- Uploads are validated by MIME + magic bytes, capped at 8 MB, and re-encoded
  with `sharp` into a 1600px display image and a 480px thumbnail, which also
  strips EXIF/GPS metadata.

## 8. Database schema

```
Country ──< City ──< Place ──< Photo
                       │  └──< PlaceCategory >── Category
                       │  └──< OpeningHour
User ──< SavedPlace >── Place
User ──< Itinerary ──< ItineraryStop >── Place
User ──1 UserPreference
User ──< UserInterest >── Category
User ──< RefreshToken / PasswordResetToken
```

Key decisions:

- **Country → City → Place is enforced by foreign keys.** Country/city are never
  free text on a place; the API rejects a `cityId` that does not belong to the
  submitted `countryId`.
- **Categories are a join table from day one** (`PlaceCategory`), with a
  denormalised `primaryCategoryId` on `Place` for cheap list rendering and pin
  styling. Many-to-many is therefore already true, not a future migration.
- **`ItineraryStop` is self-sufficient**: order, arrival offset, visit duration,
  travel time and distance from the previous stop are all persisted, so a saved
  itinerary reproduces exactly without re-running the planner.
- `importanceScore` (1–100) and `estimatedVisitDurationMinutes` live on `Place`
  and are **admin-managed data, never hardcoded in the engine.**

Full definition: [`api/prisma/schema.prisma`](../api/prisma/schema.prisma).

## 9. API architecture

REST under `/api/v1`, JSON, cursor-free page/limit pagination, uniform error
envelope `{ error: { code, message, details? } }`.

| Group | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` |
| Catalog | `GET /countries`, `/cities`, `/categories`, `/places`, `/places/:id`, `/places/nearby` |
| Me | `GET/PUT /me`, `/me/preferences`, `GET/POST/DELETE /me/saved-places` |
| Planner | `POST /planner/generate` (Mode A/C), `POST /planner/optimize` (Mode B), `POST /planner/preview` (what-if when editing) |
| Itineraries | `GET/POST /itineraries`, `GET/PUT/DELETE /itineraries/:id`, `POST /itineraries/:id/duplicate`, `PATCH /itineraries/:id/stops/:stopId` |
| Admin | `/admin/stats`, `/admin/places`, `/admin/countries`, `/admin/cities`, `/admin/categories`, `/admin/users`, `/admin/places/:id/photos` |

## 10. Smart Visit Planner architecture

`api/src/services/planner/` — pure functions, no I/O, no Prisma. It receives a
candidate list and a `RoutingProvider` and returns a plan.

```
Input   { start, cityId, availableMinutes, interests[], travelMode,
          selectedPlaceIds?, endLocation?, maxPlaces?, arrivalTime }
        │
   1.  candidates  ── active places in city, opening-hours feasible
        │
   2.  score       ── importance (admin data) · interest match · reachability
        │
   3.  build       ── budget = available − buffer(available)
        │             greedy insertion: pick the stop with the best
        │             score-per-marginal-minute that still fits the budget
        │
   4.  improve     ── 2-opt on the stop order (travel time only; scores fixed)
        │
   5.  verify      ── recompute legs, drop any stop that pushes past the budget,
        │             re-check opening hours at the real projected arrival
        ▼
Output  { stops[{place, order, arrivalOffset, visitMinutes, travelFromPrev,
          distanceFromPrev}], totalTravelMinutes, totalVisitMinutes,
          totalMinutes, bufferMinutes, totalDistanceMeters, reasons[] }
```

- **Never returns a plan that exceeds `availableMinutes`.** That invariant is a
  unit test, not a comment.
- **Buffer is never zero:** `clamp(8% of available, 10 min, 30 min)`, configurable.
- **Usefulness, not distance:** the marginal-value ratio deliberately accepts a
  farther, more significant site over a nearer trivial one.
- Interests **bias** scoring; they do not hard-filter, so a 4-hour Madinah plan
  never comes back empty because of a narrow filter.

## 11. Screens & navigation

**User tabs:** Home · Map · My Journey · Saved · Profile

```
(auth)    onboarding → login → register → forgot-password
(tabs)    home · map · journey · saved · profile
(stack)   planner (6 steps) → itinerary → route-map → navigation
          place/[id] · city/[id] · trips · trips/[id] · settings · preferences
(admin)   dashboard · places (+ new/edit) · countries · cities · categories · users
```

## 12. Development phases

| Phase | Content | State |
| --- | --- | --- |
| 0 | Architecture, monorepo layout, tooling | ✅ |
| 1 | Schema, migrations, seed (5 countries / 5 cities / 40+ real places) | ✅ |
| 2 | Auth + RBAC + catalog API | ✅ |
| 3 | Routing abstraction + Smart Visit Planner + tests | ✅ |
| 4 | Itineraries, saved places, preferences | ✅ |
| 5 | Admin API (CRUD, photos, stats) | ✅ |
| 6 | Mobile: shell, auth, home, explore, place details | ✅ |
| 7 | Mobile: planner flow → itinerary → route map → navigation | ✅ |
| 8 | Mobile: trips, saved, profile, settings, admin console | ✅ |
| 9 | Deferred (section 40 of the brief): reviews, audio guides, AI guide, prayer-time-aware planning, offline maps | ⛔ intentionally not built |

The prayer-aware schedule and AI guide screens that appear in the design
reference belong to phase 9 and are deliberately out of the MVP; the data model
leaves room for them (`Place.religiousSignificance`, itinerary buffer strategy)
without carrying their cost now.
