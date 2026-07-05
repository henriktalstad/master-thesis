# MPC — mappestruktur (referansearkitektur)

Kode under `lib/sd-anlegg/mpc/` følger blokkene i supervisory MPC-figuren.  
Thesis AHU (`mpc-v1`) velger \(u_k\) direkte; regulator = lokale BMS-løkker under SD (to-lags prinsipp, Ghawash et al. 2026).

```
lib/sd-anlegg/mpc/
├── shared/              Typer, 15-min tidsgrid
├── forecasts/           Pris/vær-inndata (avledet fra eval-datasett)
├── config/              Brukerpreferanser, bounds, tuning, komfort
├── controller/
│   ├── optimizer/       Receding-horizon MPC (solve + replay-løkke)
│   ├── regulator/       Stub for fremtidig q_h → T_sup (fjernvarme)
│   ├── state-estimator/ α-blend avtrekkstemp
│   ├── envelope-model/  Plant, baseline-emulator, effekt-proxy
│   └── policies/        Sammenligning observed / emulated / demand / mpc
├── pipeline/            Kalibrering, forward plan, E2E-analyse
└── dataset/             Gap-fylling på eval-grid

lib/sd-anlegg/control/   UI, persist, shadow writeback
  live/                  15-min tick, plan-diff, kontrollrekke
services/mpc/            run-control-tick, eval-dataset
```

## Blokk → fil

| Referanseblokk | Mappe | Nøkkelfiler |
|----------------|-------|-------------|
| Forecast inputs (REST) | `forecasts/` + `services/mpc/load-eval-dataset.ts` | `price-thresholds.ts`, pris/vær fra Prisma; live vær: `load-control-weather-forecast.ts` (MET Locationforecast) |
| User inputs (config) | `config/` | `mpc-building-preferences.ts`, `resolve-preferences.ts`, `buildings/` |
| Optimizer | `controller/optimizer/` | `solve-horizon.ts`, `replay-loop.ts` |
| Regulator | `controller/regulator/` | `regulator-policy.ts` (DirectAhu = pass-through) |
| State estimator | `controller/state-estimator/` | `extract-blend.ts` |
| Envelope model | `controller/envelope-model/` | `fit-plant-model.ts`, `fit-baseline-emulator.ts` |
| Building + DB | `services/mpc/` | `load-eval-dataset.ts`, backfill, `build-u-meas.ts` |
| Write path (shadow) | `lib/sd-anlegg/control/` | `live/persist-control-tick.ts`, `db-command-sink.ts` |
| Live loop (15 min) | `lib/sd-anlegg/control/live/` | `assess-control-tick-trigger.ts`, `run-control-tick` service |

Se PDF Method/Results og `master-thesis-app/README.md` for live pipeline.
