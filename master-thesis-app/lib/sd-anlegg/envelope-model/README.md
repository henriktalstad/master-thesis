# Envelope model (AHU thermal plant)

Kontrollorientert kuvertmodell for avtrekkstemperatur (komfortproxy) i MPC.

Modellvalget følger Bacher & Madsen-prinsippet og Prívara et al.s krav om kontrollorientert, eksplisitt modellering: minste gråboks som fanger dynamikk synlig i dataene og valideres flerstegs. Walnum et al. (2025) viser samme lavkost-strategi i felt: avtrekk som komfortproxy, enkel modell, 96×15 min horisont.

## Moduler

| Mappe | Rolle |
|-------|--------|
| `spec/` | Signal-scope (tilgjengelig / brukt / mangler) og betinget feature-valg |
| `thermal/` | Lineær plant-modell: fit, predict, validate (1-steg + multi-steg) |
| `baseline/` | BMS baseline-emulator \(u^{BMS,sim}\) |
| `power/` | Kontrollerbar el/fjernvarme-proxy for kost |
| `state/` | α-blend målt/predikert avtrekk mellom replay-steg |
| `lib/` | OLS-regresjon og statistikk |

## Plant-modell

\[
\hat T^{\mathrm{ext}}_{k+1} = \beta_0 + \sum_j \beta_j x_{j,k}
\]

**Kjerne-features (alltid):** forrige avtrekk, \(u_k\), utetemp., tid.

**Valgfrie features** (aktiveres når SD-dekning ≥ 90 % i treningsvindu):

- `supply_temp_meas`, `intake_temp_meas`, `heat_recovery_after_temp`, `extract_setpoint`

**Utilgjengelig i caset** (dokumentert i `featureScope`, ikke i modellen): sol, belegg, romtemp., CO₂.

## Validering

- **1-steg:** MAE/RMSE på holdout (som før)
- **Multi-steg (åpen løkke):** 4 h, 12 h, 24 h — prediksjonsfeil når tilstand rulleres uten målings-blend

Resultater lagres i `plantValidation` ved hver pipeline-kjøring (JSON i DB + export).

## Manglende målinger

`updateExtractState()` (α-blend i `state/extract-blend.ts`) bruker predikert avtrekk når måling mangler. Dette speiler Walnum et al.s observasjon av robust drift ved timer uten ventilasjonsfeedback. Ved kritiske mangler aktiveres MPC-fallback til emulert baseline (`shouldUseFallback`).

## Import

```ts
import {
  fitPlantModel,
  predictExtractTemperature,
  validatePlantModel,
} from "@/lib/sd-anlegg/envelope-model";
```

Kompatibilitetsstier under `mpc/controller/envelope-model/` re-eksporterer samme API.
