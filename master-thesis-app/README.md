# Master thesis app — Nærbyen 360.102

Next.js supervisory UI: measured BMS data, mpc-v1 replay and forward planning (open-loop, no BMS writeback).

## Setup

```bash
cp .env.example .env
bun install && bun run db:generate
bun run dev:pipeline
```

Configure `DATABASE_URL`, `CRON_SECRET` and `ENTSOE_SECURITY_TOKEN` in `.env` (see `.env.example`).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Case overview |
| `/sd-anlegg/sorgenfriveien-32ab/ventilasjon/360-102` | AHU schematic |
| `/sd-anlegg/sorgenfriveien-32ab/styring` | Supervisory control workspace |

## Background jobs (Inngest)

| Job | Interval |
|------|----------|
| `sync-infraspawn` | 15 min |
| `run-control-tick` | 15 min |
| `sync-weather` | 60 min |
| `sync-energy-prices` | 6 h |
| `sync-grid-tariffs` | 6 h |
| `run-live-mpc-replay` | 6 h |
| `sync-building-metering-daily` | 24 h |
| `compact-infraspawn` | 24 h |

Manual trigger: `bun run jobs --only=…`  
Deploy: [docs/DEPLOY.md](docs/DEPLOY.md)
