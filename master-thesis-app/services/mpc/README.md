# services/mpc — bygg-grensesnitt og orkestrering

I/O-lag mellom fysisk bygg (Influx/SD → Postgres) og ren algoritme (`lib/sd-anlegg/mpc/`).

| Rolle | Filer |
|-------|-------|
| Les eval-datasett | `load-eval-dataset.ts`, `build-u-meas.ts` |
| Dekning / readiness | `analyze-eval-coverage.ts`, `assess-mpc-simulation-readiness.ts` |
| Backfill | `thesis-mpc-backfill-pipeline.ts`, `backfill-signal-gaps-from-influx.ts` |
| Kjør simulering | `run-mpc-pipeline-core.ts`, `run-simulation.ts` |
| Cron | `run-mpc-when-ready.ts`, `ensure-thesis-mpc-data.ts` |
| Preferanser (disk) | `mpc-building-preferences-store.ts` |

Algoritme: [lib/sd-anlegg/mpc/README.md](../../lib/sd-anlegg/mpc/README.md)
