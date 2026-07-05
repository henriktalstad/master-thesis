# Master Thesis

**Predictive Supervisory Control for Existing Commercial Buildings with Legacy BMS Infrastructure**

Master's thesis in Cybernetics and Robotics, NTNU — June 2026  
Author: Henrik Randgaard Talstad · Supervisor: Sverre Hendseth

Case: Nærbyen 24/7, AHU 360.102 (Trondheim).  
Evaluation window: **2026-06-24 → 2026-07-03** (936 × 15 min).

## Repository

| Path | Description |
|------|-------------|
| `data/processed/` | Anonymised evaluation snapshot |
| `master-thesis-app/` | Supervisory application (measured BMS data, open-loop replay) |
| `naerbyen-infraspawn-123-points.json` | BACnet point catalogue |

## Application

```bash
cd master-thesis-app
cp .env.example .env
bun install && bun run db:generate
bun run dev:pipeline
```

Details: [master-thesis-app/README.md](master-thesis-app/README.md) · [Deploy](master-thesis-app/docs/DEPLOY.md)

## License

[LICENSE](LICENSE)
