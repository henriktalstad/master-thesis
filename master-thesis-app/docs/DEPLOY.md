# Deploy — thesis demo (Vercel + Inngest + Neon)

Planlagte jobber kjøres via **Inngest Cloud** (`vercel.json` har `"crons": []`).

## Prerequisites

| Service | Purpose |
|---------|---------|
| [Neon Postgres](https://neon.tech) | `DATABASE_URL` |
| [Vercel](https://vercel.com) | Next.js — **Root Directory:** `master-thesis-app` (Project Settings → Build and Deployment) |
| [Inngest Cloud](https://app.inngest.com) | Pipeline crons + MPC |
| ENTSO-E, Frost, Enelyze, Infraspawn | Se `.env.example` |

## Environment (Vercel)

Minimum fra `.env.example`:

```bash
DATABASE_URL=
BUILDING_SLUG=sorgenfriveien-32ab
THESIS_EVAL_START=2026-06-24
THESIS_EVAL_END=2026-07-03
MPC_CANONICAL_PIPELINE_RUN_ID=cmr6dferx0001brlw2rlledo7
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
CRON_SECRET=
DEMO_ACCESS_TOKEN=          # optional access gate
```

## Inngest

1. Deploy app til Vercel.
2. Inngest Dashboard → Apps → sync `/api/inngest`.
3. Verifiser: `cron-sync-infraspawn`, `cron-run-control-tick`, `cron-ensure-thesis-mpc-data`, `cron-sync-building-metering-daily`.

## Post-deploy

```bash
bun run backfill-control-signal-buckets
bun run mpc-replay-smoke
```
