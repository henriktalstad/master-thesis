import { defineConfig } from "prisma/config";
import {
  formatPrismaEnvStatus,
  loadPrismaEnv,
  resolvePrismaDatasource,
  shouldLogPrismaEnv,
} from "./prisma/env";

loadPrismaEnv();

if (shouldLogPrismaEnv()) {
  console.info(`◇ ${formatPrismaEnvStatus()}`);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: resolvePrismaDatasource(),
});
