# Deploying Sufara

GitHub Actions drives everything. Render runs the API, Neon holds the database,
Cloudflare R2 stores photos, and EAS builds the mobile app.

**Never paste a credential into a chat, an issue, or a commit.** Every secret
below goes into **Settings → Secrets and variables → Actions** on the GitHub
repository, or into the provider's own dashboard. The workflows reference them by
name only.

```
 push to main ─► ┌───────────────────────────────────────────┐
                 │ .github/workflows/deploy-api.yml          │
                 │  1. check the prod schema hasn't drifted  │
                 │  2. prisma migrate deploy  ──► Neon       │
                 │  3. POST Render deploy hook ──► Render    │
                 │  4. poll /health until ok                 │
                 └───────────────────────────────────────────┘

 manual      ─► mobile-build.yml ──► EAS ──► APK / AAB / IPA
 every PR    ─► ci.yml ──► api tests + typechecks + web export
```

Migrations finish **before** Render is told to deploy, so the schema is never
behind the code that expects it. That ordering is why `render.yaml` sets
`autoDeploy: false` — otherwise Render would race the workflow.

---

## What I need from you

### GitHub → Actions **secrets**

| Secret | Where to get it |
| --- | --- |
| `NEON_DATABASE_URL` | Neon → Connection details → **Pooled** string (host contains `-pooler`), with `?sslmode=require` |
| `NEON_DIRECT_URL` | Neon → the **Direct** string (no `-pooler`), with `?sslmode=require` |
| `RENDER_DEPLOY_HOOK_URL` | Render → your service → Settings → **Deploy Hook** |
| `EXPO_TOKEN` | expo.dev → account → **Access tokens** → create a robot token |
| `SEED_PASSWORD` | You choose it. Only needed to run the one-off seed; it becomes the admin password |

### GitHub → Actions **variables** (not secret)

| Variable | Value |
| --- | --- |
| `API_BASE_URL` | `https://sufara-api.onrender.com` — lets the deploy workflow verify `/health` |
| `EAS_PROJECT_ID` | The id `eas init` prints. Optional if you paste it into `app.config.ts` |

### Render → Environment (the API's own runtime config)

Render prompts for each of these on the first Blueprint deploy, because
`render.yaml` marks them `sync: false`. These are **not** GitHub secrets — they
belong to the running service:

`DATABASE_URL` (pooled), `DIRECT_URL` (direct), `API_BASE_URL`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_BASE_URL`.

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` use `generateValue: true` — Render
generates them and nobody ever handles them. Leave them alone.

> Yes, the Neon URLs are needed in both places: GitHub Actions uses them to run
> migrations, Render uses them to serve requests.

### EAS → project secrets

The Android Maps key is read at prebuild time on EAS's builders, so it cannot
come from a GitHub secret:

```bash
cd mobile
eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key>
```

Without it the app still builds; only the Android map renders blank.

---

## First-time setup, in order

1. **Neon** — create a project (PostgreSQL 16/17) near your Render region. Copy
   both connection strings. Getting pooled and direct the wrong way round is the
   classic Prisma + Neon failure, and it shows up only as a migration that hangs.

2. **Cloudflare R2** — create a bucket (e.g. `sufara-photos`), enable public read
   (managed `r2.dev` domain or your own), then **R2 → Manage API Tokens** and
   create a token scoped to **Object Read & Write on that bucket only**.

   R2 is not optional in production: Render's filesystem is recycled on every
   deploy, so local-disk uploads would vanish. The API refuses to boot if
   `STORAGE_PROVIDER=r2` is incompletely configured, and warns loudly if you run
   production on local disk.

3. **Render** — New → Blueprint → this repository. It reads `render.yaml`, creates
   `sufara-api`, and prompts for the variables above. Once it assigns a URL, set
   `API_BASE_URL` in Render to that URL and redeploy.

4. **GitHub** — add the secrets and variables listed above.

5. **Seed the database, once.** Actions → *Deploy API* → **Run workflow**, with
   **seed** ticked. It refuses to run unless `SEED_PASSWORD` is set, so that no
   generated password is ever written into a build log.

   The seed creates `admin@sufara.app` (ADMIN) and `traveler@sufara.app` (USER),
   both using `SEED_PASSWORD`. It is safe to re-run: it never resets a password
   that already exists. Delete or disable the traveller account once you are in —
   it is a development convenience, not a production account.

6. **Mobile** — put your Render URL into `mobile/eas.json` under
   `build.preview.env.EXPO_PUBLIC_API_URL` (and `build.production`), commit, then
   Actions → *Mobile build (EAS)* → **Run workflow** → platform `android`,
   profile `preview`. That produces an installable APK. The workflow fails fast if
   the URL is unset, and warns if it is still the placeholder.

From then on, any push to `main` touching `api/**` migrates Neon and deploys
Render by itself.

---

## The workflows

| File | Trigger | Does |
| --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | every PR and push to `main` | API typecheck + 67 tests, production-schema drift check, API build, mobile typecheck, web export |
| [`deploy-api.yml`](../.github/workflows/deploy-api.yml) | push to `main` under `api/**`, or manual | Schema drift check → migrate Neon → optional seed → Render deploy hook → poll `/health` for up to 10 min |
| [`mobile-build.yml`](../.github/workflows/mobile-build.yml) | manual only | `eas build` for android/ios/all against `preview` (APK) or `production` (AAB/IPA), optional `eas submit` |

`deploy-api.yml` targets the `production` GitHub environment — add required
reviewers to it in repo settings if you want a human approval gate before
anything touches the live database.

Mobile builds are manual on purpose: each one consumes an EAS build slot, and a
build is only useful once the API it points at exists.

## Cloudflare Pages — the web build (optional)

Gives you a shareable review URL alongside the native apps.

| Setting | Value |
| --- | --- |
| Root directory | `mobile` |
| Build command | `npm ci && npm run build:web` |
| Output directory | `dist` |
| Environment variable | `EXPO_PUBLIC_API_URL = https://<your-render-url>/api/v1` |
| Environment variable (optional) | `EXPO_PUBLIC_MAPTILER_API_KEY = <your MapTiler key>` |

`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_MAPTILER_API_KEY` are **baked in at build
time**, not read at runtime — change them and you must rebuild. Metro also
caches aggressively; if a rebuild seems to ignore a changed URL, build with
`npx expo export --platform web --clear`.

`mobile/public/_redirects` and `_headers` are copied into the export
automatically, giving the single-page app its deep-link fallback and security
headers.

### Web basemap

- With `EXPO_PUBLIC_MAPTILER_API_KEY` set, the web app renders a real tiled
  basemap via MapLibre GL against MapTiler. Get a free key at
  https://cloud.maptiler.com/account/keys/ (100k tile loads per month, no
  credit card at signup).
- Without it, the web app falls back to a schematic plan view — every planning
  screen still works with zero setup. The engine is MapLibre GL (the
  open-source fork of Mapbox GL); swapping MapTiler for another provider is
  a one-line style URL change in `TiledMapCanvas.web.tsx`.

Native builds still use the platform basemap (Apple Maps on iOS, Google Maps
on Android via `GOOGLE_MAPS_ANDROID_API_KEY`) and do not depend on MapTiler.

---

## After deploying — verify

```bash
API=https://<your-render-url>

curl -s $API/health
# {"status":"ok","service":"sufara-api","routing":"haversine"}

# Case-insensitive search — the PostgreSQL regression this guards against
curl -s "$API/api/v1/places?search=quba&limit=1" | head -c 120
# must return Quba Mosque; empty means DATABASE_PROVIDER is not postgresql

# The planner, end to end
CITY=$(curl -s $API/api/v1/cities | python3 -c "import sys,json;print([c['id'] for c in json.load(sys.stdin)['items'] if c['name']=='Madinah'][0])")
curl -s -X POST $API/api/v1/planner/generate -H 'Content-Type: application/json' \
  -d "{\"cityId\":\"$CITY\",\"start\":{\"latitude\":24.4686,\"longitude\":39.6142},\"availableMinutes\":240}" \
  | python3 -c "import sys,json;p=json.load(sys.stdin)['plan'];print(len(p['stops']),'stops,',p['totals']['totalMinutes'],'minutes')"
# e.g. "4 stops, 207 minutes"

# Admin routes must reject an anonymous caller
curl -s -o /dev/null -w "%{http_code}\n" $API/api/v1/admin/stats   # expect 401
```

Then sign in as the admin, upload a photo to any place, and confirm the returned
URL is on your R2 domain and loads. That is the one path no amount of local
testing can cover.

## Changing the schema later

`api/prisma/schema.prisma` is canonical and uses SQLite, so local development and
the test suite need no database server. After editing it:

```bash
npm --prefix api run prisma:migrate      # SQLite migration for local dev
npm --prefix api run prisma:prod:sync    # regenerate the PostgreSQL schema
```

Then create the matching PostgreSQL migration:

```bash
cd api
mkdir -p prisma/production/migrations/$(date +%Y%m%d%H%M%S)_your_change
npx prisma migrate diff \
  --from-migrations prisma/production/migrations \
  --to-schema-datamodel prisma/production/schema.prisma \
  --shadow-database-url "$DIRECT_URL" \
  --script > prisma/production/migrations/*_your_change/migration.sql
```

CI runs `prisma:prod:check`, so forgetting `prisma:prod:sync` fails the pull
request rather than the deploy.

## Known limitation of this repository's verification

The test suite runs against SQLite, and the PostgreSQL path was generated
offline — no Postgres server was available where this was written (no Docker
daemon, and `initdb` could not run). The generated schema and migration are
asserted by tests, and the single behavioural difference between the providers is
handled in [`api/src/lib/search.ts`](../api/src/lib/search.ts) — but **the
migration has not been executed against a live PostgreSQL instance.**

Run this once against a throwaway Neon **branch** before pointing the pipeline at
production:

```bash
cd api
export DATABASE_URL='<neon branch POOLED url>'
export DIRECT_URL='<neon branch DIRECT url>'
export DATABASE_PROVIDER=postgresql
export SEED_PASSWORD='<anything, for this throwaway branch>'

npm run prisma:prod:deploy      # applies 0_init
npm run prisma:prod:generate
npx tsx prisma/seed.ts

# Then run the suite against PostgreSQL rather than SQLite:
npx vitest run tests/flow.test.ts tests/admin.test.ts
```

If that passes, the production path is exercised end to end.
