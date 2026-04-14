# Email Campaign Automation

PayloadCMS + Next.js app that builds and sends automated email campaigns
(Klaviyo) with products pulled from Shopify or Magento stores.

## Requirements

- Docker + Docker Compose
- Node.js 20+ (only needed for local dev against the container's
  postgres, or for running tests outside docker)

## Configuration

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — postgres connection string
  - Host-run dev: `postgresql://payload:payload@localhost:5433/payload`
  - Container: `postgresql://payload:payload@postgres:5432/payload` (the
    app service already sets this via compose env, so `.env` is only
    needed when running `next dev` on the host)
- `PAYLOAD_SECRET` — random secret; must be stable across restarts

---

## Production

The base `docker-compose.yml` is prod-safe: postgres is only reachable
inside the docker network, and the app is published on host port 3003.

```bash
git pull
docker compose build
docker compose up -d
docker compose logs -f app   # optional: watch logs
```

Open `http://<host>:3003/admin`.

To update after a git pull:

```bash
docker compose build
docker compose up -d
```

### Persistent data

Named volumes survive `docker compose down`:

- `postgres_data` — database
- `media_data`    — uploaded media (mapped to `/app/media`)

`docker compose down -v` deletes both — don't run that on prod unless
you mean it.

---

## Local development

Two workflows. Pick whichever you prefer.

### Option A — run `next dev` on host, postgres in docker

Fastest feedback loop (hot reload, no rebuild).

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
npm install
npm run dev
```

The dev override republishes postgres on host port 5433 so the host
`next dev` process can reach it. Visit `http://localhost:3000/admin`.

### Option B — everything in docker

Matches the production build more closely; slower iteration because
code changes require a rebuild.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- App: `http://localhost:3000/admin` (dev override) or `:3003` (prod mapping — both are bound).
- Postgres: `localhost:5433`.

### Stopping

```bash
docker compose down          # stop and remove containers (keeps volumes)
docker compose down -v       # also wipes postgres + media (destructive)
```

---

## Tests

```bash
npm test              # vitest, all suites
npm test -- --run <path-glob>
```

All collection and service tests run without a live database or external
APIs.

---

## Project layout

- `src/collections` — Payload collection definitions
- `src/services`    — business logic (product fetchers, selectors,
                      email builder, campaign sender, scheduler)
- `src/app/(payload)/custom` — custom API routes (`preview`, `draft`,
                               `send-test`) used by the Campaign Tester
- `src/components/admin/CampaignTesterView.tsx` — admin UI to preview a
  campaign, create a Klaviyo draft, and send a test email
- `src/__tests__`   — vitest suites mirroring `src/`
- `email template.html` — design reference for the email builder
