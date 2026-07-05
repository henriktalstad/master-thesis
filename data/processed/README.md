# Processed data

Anonymised evaluation snapshot for the thesis case study.

**Window:** 2026-06-24 → 2026-07-03 (936 × 15 min)

## Core files

| File | Content |
|------|---------|
| `metrics_summary.json` | Aggregated KPIs |
| `policy_comparison_summary.json` | Four-policy comparison |
| `mpc_counterfactual.csv` | Four-policy replay (15-min grid) |
| `signal_registry.csv` | BACnet point catalogue |
| `calibration_snapshot.json` | Calibration |
| `holdout_split.json` | Train/holdout 70/30 |
| `model_readiness.json` | Readiness gates |
| `price_load_analysis.json` | High-price load shift |
| `energy_reconcile_summary.json` | Building vs AHU proxy |
| `mpc_forward_plan.csv` | Forward-plan context |
| `energy_attest_naerbyen.json` | Energy attest / net demand |
| `sensitivity_summary.json` | ±20 % proxy sensitivity |
| `mpc_sensitivity_report.json` | Replay-based sensitivity |
| `mpc_tuning_report.json` | Preset sweep |
| `mpc_lambda_move_smoke_sweep.json` | λ_move smoke test |
| `control_methods_summary.json` | Policy/tuning summary |

Units: °C · kW/kWh · % · ISO 8601 UTC.

## Diagnostics

| File | Content |
|------|---------|
| `coverage_report.json` | Signal coverage |
| `mpc_e2e_report.json` | End-to-end health |
| `forward_plan_summary.json` | Forward-plan KPI |
| `anlegg_control_comparison.json` | Plant scope vs AHU |
| `building_hourly_measured.csv` | Building-level time series |
| `building_energy_audit.json` | Building energy audit |
| `energy_comparison.json` | Attest comparison |
| `cooling_valve_audit.json` | Cooling valve command vs feedback |
