CREATE SCHEMA IF NOT EXISTS "public";

DO $$ BEGIN
  CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'MANAGER', 'JANITOR', 'TENANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InfraspawnAlarmKind" AS ENUM ('ALARM', 'FAULT', 'OUT_OF_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InfraspawnAlarmSeverity" AS ENUM ('A', 'B', 'C', 'FAULT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InfraspawnSystemDomain" AS ENUM ('VENTILATION', 'HEATING', 'SYSTEM', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EnergyPriceSource" AS ENUM ('NORD_POOL', 'ENTSOE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AreaMeasurementBasis" AS ENUM ('BTA', 'BRA', 'NTA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM ('ELHUB', 'CELSIO', 'A_VARME', 'ENGAGE', 'SMARTVATTEN', 'STATKRAFT', 'FENISTRA', 'FAZILE', 'ENOCO', 'ELVACO_EVO', 'INFRASPAWN', 'HENTEPLAN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'PENDING_SETUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationType" AS ENUM ('ELECTRICITY', 'DISTRICT_HEATING', 'WASTE', 'WATER', 'PROPERTY_MANAGEMENT', 'METERING_IMPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BackfillState" AS ENUM ('BASELINE', 'GAPS', 'COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AllocationTrack" AS ENUM ('CLASSIC', 'FENISTRA', 'FAZILE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeteringPointType" AS ENUM ('ELECTRICITY', 'HEAT', 'COOLING', 'PRODUCTION', 'WATER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EnergyFlowStage" AS ENUM ('GRID_DELIVERED', 'GRID_EXPORTED', 'CONSUMPTION', 'PRODUCTION_GROSS', 'DISTRIBUTION', 'CONVERSION_INPUT', 'AMBIENT_SOURCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeterHierarchyRole" AS ENUM ('TOTAL', 'BRANCH', 'LEAF', 'STANDALONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CtPlacement" AS ENUM ('LOAD_BRANCH', 'FEED_MAIN', 'PV_OUTPUT', 'BATTERY', 'THERMAL_PRODUCTION', 'THERMAL_DELIVERY', 'AMBIENT', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BuildingMeteringTopology" AS ENUM ('GRID_AMS_ONLY', 'SUB_METER_ONLY', 'HYBRID_AMS_PLUS_SUB', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeterVerificationStatus" AS ENUM ('AUTO', 'VERIFIED', 'DEFERRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubMeterCategory" AS ENUM ('OPPVARMING', 'VENTILASJON', 'KJOLING', 'BELYSNING', 'STIKKONTAKT', 'TAPPEVANN', 'HEIS', 'ELBIL_LADING', 'IT_DATAROM', 'VARMEPUMPE', 'SOLCELLE', 'SNOSMELTING', 'FORDELING', 'FELLES', 'TEKNISK', 'PROSESS', 'ANNET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubMeterSubCategory" AS ENUM ('GULVVARME', 'RADIATOR', 'KONVEKTOR', 'AEROTEMPER', 'SNOSMELTING_VARMEKABLER', 'VARMEBATTERI', 'VIFTE', 'VARMEBATTERI_VENT', 'KJOLEBATTERI', 'ROTOR_GJENVINNER', 'CHILLER', 'DX_AGGREGAT', 'TORRKJOLER', 'PROSESSKJOLING', 'VP_PRODUKSJON', 'VP_KALD_SIDE', 'VP_VARM_SIDE', 'KJOKKEN', 'LAB', 'VERKSTED', 'KONTOR', 'PROSESSUTSTYR', 'INNVENDIG_BELYSNING', 'UTVENDIG_BELYSNING', 'NODBELYSNING', 'IT_LAST', 'UPS', 'IT_KJOLING', 'AUTOMASJON', 'STYRING', 'MIDLERTIDIG_STROM', 'VVB', 'SIRKULASJONSPUMPE', 'PERSONHEIS', 'VAREHEIS', 'RULLETRAPP', 'NORMALLADER', 'HURTIGLADER', 'PV_PANEL', 'INVERTER', 'BATTERILAGRING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "imageUrl" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastSignInAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "alertDefaults" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "quietHoursMinPriority" "NotificationPriority" DEFAULT 'CRITICAL',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "organization_to_users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_to_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "clientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "subscriptionKeyEncrypted" TEXT,
    "apiUrl" TEXT,
    "identityUrl" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "infraspawn_sources" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "influxDatabase" TEXT NOT NULL,
    "apiTokenEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ(6),
    "lastSuccessfulSyncAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "infraspawn_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "infraspawn_bacnet_point_meta" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectName" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "infraspawn_bacnet_point_meta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "infraspawn_bacnet_samples" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "sampledAt" TIMESTAMPTZ(6) NOT NULL,
    "resolution" TEXT NOT NULL DEFAULT 'hour',
    "valueNum" DOUBLE PRECISION,
    "quality" TEXT,
    "sampleCount" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "infraspawn_bacnet_samples_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "infraspawn_sync_states" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "watermarkAt" TIMESTAMPTZ(6),
    "lastRunAt" TIMESTAMPTZ(6),
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "lastError" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "infraspawn_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "infraspawn_alarm_events" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" "InfraspawnAlarmKind" NOT NULL,
    "severity" "InfraspawnAlarmSeverity" NOT NULL,
    "alarmText" TEXT NOT NULL,
    "valueAtActivation" DOUBLE PRECISION,
    "valueAtClear" DOUBLE PRECISION,
    "activatedAt" TIMESTAMPTZ(6) NOT NULL,
    "clearedAt" TIMESTAMPTZ(6),
    "domain" "InfraspawnSystemDomain",
    "metadata" JSONB DEFAULT '{}',
    "openDedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "infraspawn_alarm_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_site_profiles" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "displayTitle" TEXT,
    "heroImageUrl" TEXT,
    "clientLogoUrl" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactLabel" TEXT,
    "featuredPointRefs" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sd_anlegg_site_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_simulation_runs" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "horizonHours" INTEGER NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "modelVersion" TEXT NOT NULL DEFAULT 'scoped-v1',
    "inputFingerprint" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL DEFAULT 'page_load',
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "recommendedScenarioId" TEXT NOT NULL DEFAULT 'scoped',
    "baselineSummary" JSONB NOT NULL,
    "recommendedSummary" JSONB NOT NULL,
    "scenarios" JSONB NOT NULL,
    "sdSignalCoveragePct" DOUBLE PRECISION,
    "planId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_control_simulation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_plans" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizonHours" INTEGER NOT NULL DEFAULT 24,
    "status" TEXT NOT NULL DEFAULT 'active',
    "inputFingerprint" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sd_anlegg_control_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_plan_hours" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "hour" TIMESTAMPTZ(6) NOT NULL,
    "spotKrPerKwh" DOUBLE PRECISION,
    "effectiveMarginalKrPerKwh" DOUBLE PRECISION,
    "outdoorTempC" DOUBLE PRECISION,
    "scopedProfile" JSONB NOT NULL,
    "gjeldendeProfile" JSONB,
    "expectedDeltaKwh" DOUBLE PRECISION,
    "expectedDeltaCostKr" DOUBLE PRECISION,

    CONSTRAINT "sd_anlegg_control_plan_hours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_reconcile_hours" (
    "id" TEXT NOT NULL,
    "planHourId" TEXT NOT NULL,
    "maeSetpoint" DOUBLE PRECISION,
    "maeFan" DOUBLE PRECISION,
    "actualEnergyKwh" DOUBLE PRECISION,
    "actualCostKr" DOUBLE PRECISION,
    "reconciledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_control_reconcile_hours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
    "evalStart" TIMESTAMPTZ(6) NOT NULL,
    "evalEnd" TIMESTAMPTZ(6) NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "stepCount" INTEGER NOT NULL,
    "trainStepCount" INTEGER NOT NULL,
    "holdoutStepCount" INTEGER NOT NULL,
    "emulatorValidation" JSONB NOT NULL,
    "plantValidation" JSONB NOT NULL,
    "replaySummary" JSONB NOT NULL,
    "hourlyComparison" JSONB NOT NULL,
    "replaySteps" JSONB NOT NULL,
    "calibration" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_mpc_pipeline_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "thesis_eval_periods" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "sdCoverageThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thesis_eval_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "thesis_export_runs" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "evalPeriodId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputFingerprint" TEXT,
    "manifest" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "thesis_export_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "postCode" TEXT NOT NULL,
    "postalPlace" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "buildingSize" DOUBLE PRECISION NOT NULL,
    "btaSqm" DOUBLE PRECISION,
    "tenantLeaseAreaCapBasis" "AreaMeasurementBasis" NOT NULL DEFAULT 'BRA',
    "imageUrl" TEXT,
    "buildingYear" INTEGER,
    "municipalityNumber" TEXT,
    "municipalityName" TEXT,
    "propertyNumber" TEXT,
    "sectionNumber" TEXT,
    "shareNumber" TEXT,
    "shareHolderNumber" TEXT,
    "availableUnits" TEXT[],
    "buildingTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "selectedGridOperatorId" TEXT,
    "slug" TEXT,
    "applicableTEKStandard" TEXT,
    "targetTEKStandard" TEXT DEFAULT 'TEK17',
    "climateTargets" JSONB,
    "comfortTargets" JSONB,
    "energyLabelTarget" TEXT,
    "gapAnalysisFrequency" TEXT DEFAULT 'ANNUAL',
    "lastGapAnalysisAt" TIMESTAMP(3),
    "passivehusTarget" BOOLEAN NOT NULL DEFAULT false,
    "buildingCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "costRollupInvalidatedAt" TIMESTAMPTZ(6),
    "allocationMethod" TEXT,
    "allocationTrack" "AllocationTrack",
    "meteringTopology" "BuildingMeteringTopology" NOT NULL DEFAULT 'UNKNOWN',
    "meteringTopologyVerifiedAt" TIMESTAMP(3),
    "meteringTopologyNotes" TEXT,
    "hasUnregisteredHeatSource" BOOLEAN NOT NULL DEFAULT false,
    "hasUnregisteredCoolingSource" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "building_addresses" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddr" TEXT NOT NULL,
    "postCode" TEXT NOT NULL,
    "postalPlace" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "numberFrom" INTEGER,
    "numberTo" INTEGER,
    "letterFrom" TEXT,
    "letterTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "weather_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weather_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "weather_series" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "level" INTEGER,
    "unit" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weather_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "weather_observations" (
    "seriesId" TEXT NOT NULL,
    "referenceTime" TIMESTAMPTZ(6) NOT NULL,
    "value" DECIMAL,
    "qualityCode" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_observations_pk" PRIMARY KEY ("seriesId","referenceTime")
);

CREATE TABLE IF NOT EXISTS "building_weather_station" (
    "buildingId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stationName" TEXT,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "primaryResolution" TEXT NOT NULL,
    "resolutionsAvailable" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chosenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'distance_then_resolution_5km',
    "firstObservationAt" TIMESTAMPTZ(6),
    "lastObservationAt" TIMESTAMPTZ(6),

    CONSTRAINT "building_weather_station_pkey" PRIMARY KEY ("buildingId")
);

CREATE TABLE IF NOT EXISTS "metering_points" (
    "id" TEXT NOT NULL,
    "mpid" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "postalPlace" TEXT,
    "region" TEXT,
    "type" "MeteringPointType" NOT NULL DEFAULT 'ELECTRICITY',
    "BRA" TEXT,
    "BTA" TEXT,
    "intensityAreaBasis" "AreaMeasurementBasis",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clerkOrgId" TEXT NOT NULL,
    "buildingId" TEXT,
    "firstObservationAt" TIMESTAMP(3),
    "lastObservationAt" TIMESTAMP(3),
    "technicalSharePct" DOUBLE PRECISION,
    "integrationId" TEXT,
    "backfillState" "BackfillState" NOT NULL DEFAULT 'BASELINE',
    "backfillCursorFrom" TIMESTAMP(3),
    "backfillEmptyStreak" INTEGER NOT NULL DEFAULT 0,
    "backfillNextRunAt" TIMESTAMP(3),
    "apiFirstObservationAt" TIMESTAMP(3),
    "apiLastObservationAt" TIMESTAMP(3),
    "parentMeteringPointId" TEXT,
    "isSubMeter" BOOLEAN NOT NULL DEFAULT false,
    "includeInTotal" BOOLEAN NOT NULL DEFAULT true,
    "subMeterCategory" "SubMeterCategory",
    "subMeterSubCategory" "SubMeterSubCategory",
    "subMeterLabel" TEXT,
    "meterLocation" TEXT,
    "externalSubMeterId" TEXT,
    "folderId" TEXT,
    "isIncremental" BOOLEAN NOT NULL DEFAULT false,
    "lastImportRawValue" DOUBLE PRECISION,
    "lastImportRawTime" TIMESTAMP(3),
    "flowStage" "EnergyFlowStage",
    "hierarchyRole" "MeterHierarchyRole",
    "ctPlacement" "CtPlacement",
    "energySourcedFromId" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "classifiedByUserId" TEXT,
    "classificationNotes" TEXT,
    "verificationStatus" "MeterVerificationStatus" NOT NULL DEFAULT 'AUTO',
    "isTenantBillable" BOOLEAN,

    CONSTRAINT "metering_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "metering_point_placements" (
    "id" TEXT NOT NULL,
    "meteringPointId" TEXT NOT NULL,
    "areaPlanVersionId" TEXT,
    "areaSpaceSnapshotId" TEXT,
    "floorPlanId" TEXT,
    "coveragePct" DOUBLE PRECISION,
    "anchorJson" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "metering_point_placements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "metering_point_to_buildings" (
    "id" TEXT NOT NULL,
    "meteringPointId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "matchMethod" TEXT,
    "confidence" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "weightPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metering_point_to_buildings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "observations" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "utcTime" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "volume_kwh" DOUBLE PRECISION NOT NULL,
    "meteringPointId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedByUserId" TEXT,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "accumulated_observations" (
    "id" TEXT NOT NULL,
    "meteringPointId" TEXT,
    "importPlaceholderMeterId" TEXT,
    "source" "IntegrationProvider",
    "sourceTimestampRaw" TEXT NOT NULL,
    "sourceTimestampParsed" TIMESTAMP(3),
    "rawValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accumulated_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "district_heating_measurements" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "utcTime" TIMESTAMP(3) NOT NULL,
    "meteringPointId" TEXT NOT NULL,
    "energyKwh" DOUBLE PRECISION,
    "flowM3h" DOUBLE PRECISION,
    "forwardTempC" DOUBLE PRECISION,
    "returnTempC" DOUBLE PRECISION,
    "diffTempK" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "resolution" TEXT NOT NULL DEFAULT 'hour',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "district_heating_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "daily_energy_prices" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "averagePrice" DOUBLE PRECISION,
    "areaCode" TEXT,
    "source" "EnergyPriceSource",
    "avg7d" DOUBLE PRECISION,
    "avg30d" DOUBLE PRECISION,
    "avg365d" DOUBLE PRECISION,
    "trend7dPct" DOUBLE PRECISION,
    "trend30dPct" DOUBLE PRECISION,
    "trend365dPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_energy_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hourly_energy_prices" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "hour" INTEGER,
    "price" DOUBLE PRECISION,
    "areaCode" TEXT,
    "source" "EnergyPriceSource",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hourly_energy_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quarter_hourly_energy_prices" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6),
    "hour" INTEGER,
    "quarter" INTEGER,
    "price" DOUBLE PRECISION,
    "areaCode" TEXT,
    "source" "EnergyPriceSource",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quarter_hourly_energy_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grid_operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationNumber" TEXT NOT NULL,
    "counties" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grid_operators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grid_tariffs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gridOperatorId" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tariffGroup" INTEGER NOT NULL,
    "energyLink" DOUBLE PRECISION NOT NULL,
    "fixedLink" DOUBLE PRECISION NOT NULL,
    "capacityLink" DOUBLE PRECISION,
    "powerStageFromKw" DOUBLE PRECISION,
    "powerstageToKw" DOUBLE PRECISION,
    "basisPowerStage" TEXT,
    "yearTrend" DOUBLE PRECISION NOT NULL,
    "monthTrend" DOUBLE PRECISION,
    "weekTrend" DOUBLE PRECISION,

    CONSTRAINT "grid_tariffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "building_hourly_cost_cache" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "hour" TIMESTAMPTZ(6) NOT NULL,
    "electricitySpotCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityGridEnergyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityFixedAllocKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityConsumptionTaxCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityVolumeKwh" DOUBLE PRECISION,
    "electricityPriceNokPerKwh" DOUBLE PRECISION,
    "coolingSpotCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coolingGridEnergyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coolingFixedAllocKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coolingTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coolingConsumptionTaxCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coolingVolumeKwh" DOUBLE PRECISION,
    "coolingPriceNokPerKwh" DOUBLE PRECISION,
    "productionSpotCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionGridEnergyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionFixedAllocKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionConsumptionTaxCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionVolumeKwh" DOUBLE PRECISION,
    "productionPriceNokPerKwh" DOUBLE PRECISION,
    "districtHeatingSpotCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingDiscountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingEffectCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingFixedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingNetworkCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingAdminCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingElectricityTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "districtHeatingVolumeKwh" DOUBLE PRECISION,
    "districtHeatingPriceNokPerKwh" DOUBLE PRECISION,
    "spotPriceSource" "EnergyPriceSource",
    "rollupSource" TEXT NOT NULL DEFAULT 'building_hourly_costs_sync',
    "calculatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_hourly_cost_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_clerkUserId_key" ON "users"("clerkUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE INDEX IF NOT EXISTS "organization_to_users_userId_idx" ON "organization_to_users"("userId");

CREATE INDEX IF NOT EXISTS "organization_to_users_organizationId_idx" ON "organization_to_users"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_to_users_organizationId_userId_key" ON "organization_to_users"("organizationId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_clerkOrgId_key" ON "organizations"("clerkOrgId");

CREATE INDEX IF NOT EXISTS "organizations_name_idx" ON "organizations"("name");

CREATE INDEX IF NOT EXISTS "organizations_onboardingCompleted_idx" ON "organizations"("onboardingCompleted");

CREATE INDEX IF NOT EXISTS "organizations_createdAt_idx" ON "organizations"("createdAt");

CREATE INDEX IF NOT EXISTS "integrations_organizationId_idx" ON "integrations"("organizationId");

CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "integrations"("provider");

CREATE INDEX IF NOT EXISTS "integrations_type_idx" ON "integrations"("type");

CREATE INDEX IF NOT EXISTS "integrations_status_idx" ON "integrations"("status");

CREATE INDEX IF NOT EXISTS "integrations_lastSyncAt_idx" ON "integrations"("lastSyncAt");

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_organizationId_provider_key" ON "integrations"("organizationId", "provider");

CREATE INDEX IF NOT EXISTS "infraspawn_sources_organizationId_idx" ON "infraspawn_sources"("organizationId");

CREATE INDEX IF NOT EXISTS "infraspawn_sources_integrationId_idx" ON "infraspawn_sources"("integrationId");

CREATE INDEX IF NOT EXISTS "infraspawn_sources_buildingId_idx" ON "infraspawn_sources"("buildingId");

CREATE INDEX IF NOT EXISTS "infraspawn_sources_isActive_idx" ON "infraspawn_sources"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_sources_integrationId_influxDatabase_key" ON "infraspawn_sources"("integrationId", "influxDatabase");

CREATE INDEX IF NOT EXISTS "infraspawn_bacnet_point_meta_sourceId_idx" ON "infraspawn_bacnet_point_meta"("sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_bacnet_point_meta_sourceId_objectId_key" ON "infraspawn_bacnet_point_meta"("sourceId", "objectId");

CREATE INDEX IF NOT EXISTS "infraspawn_bacnet_samples_sourceId_resolution_sampledAt_idx" ON "infraspawn_bacnet_samples"("sourceId", "resolution", "sampledAt");

CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_bacnet_samples_sourceId_objectId_sampledAt_resol_key" ON "infraspawn_bacnet_samples"("sourceId", "objectId", "sampledAt", "resolution");

CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_sync_states_sourceId_key" ON "infraspawn_sync_states"("sourceId");

CREATE INDEX IF NOT EXISTS "infraspawn_alarm_events_buildingId_activatedAt_idx" ON "infraspawn_alarm_events"("buildingId", "activatedAt");

CREATE INDEX IF NOT EXISTS "infraspawn_alarm_events_sourceId_objectId_clearedAt_idx" ON "infraspawn_alarm_events"("sourceId", "objectId", "clearedAt");

CREATE INDEX IF NOT EXISTS "infraspawn_alarm_events_buildingId_clearedAt_idx" ON "infraspawn_alarm_events"("buildingId", "clearedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_alarm_events_openDedupeKey_key" ON "infraspawn_alarm_events"("openDedupeKey");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_site_profiles_buildingId_key" ON "sd_anlegg_site_profiles"("buildingId");

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_simulation_runs_buildingId_createdAt_idx" ON "sd_anlegg_control_simulation_runs"("buildingId", "createdAt");

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_simulation_runs_buildingId_modelVersion_c_idx" ON "sd_anlegg_control_simulation_runs"("buildingId", "modelVersion", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_simulation_runs_buildingId_inputFingerpri_key" ON "sd_anlegg_control_simulation_runs"("buildingId", "inputFingerprint", "modelVersion");

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_plans_buildingId_status_idx" ON "sd_anlegg_control_plans"("buildingId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_plans_buildingId_planDate_modelVersion_key" ON "sd_anlegg_control_plans"("buildingId", "planDate", "modelVersion");

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_plan_hours_planId_idx" ON "sd_anlegg_control_plan_hours"("planId");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_plan_hours_planId_hour_key" ON "sd_anlegg_control_plan_hours"("planId", "hour");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_reconcile_hours_planHourId_key" ON "sd_anlegg_control_reconcile_hours"("planHourId");

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs_buildingId_createdAt_idx" ON "sd_anlegg_mpc_pipeline_runs"("buildingId", "createdAt");

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs_buildingId_modelVersion_created_idx" ON "sd_anlegg_mpc_pipeline_runs"("buildingId", "modelVersion", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs_buildingId_inputFingerprint_mod_key" ON "sd_anlegg_mpc_pipeline_runs"("buildingId", "inputFingerprint", "modelVersion");

CREATE INDEX IF NOT EXISTS "thesis_eval_periods_buildingId_isActive_idx" ON "thesis_eval_periods"("buildingId", "isActive");

CREATE INDEX IF NOT EXISTS "thesis_eval_periods_startDate_endDate_idx" ON "thesis_eval_periods"("startDate", "endDate");

CREATE INDEX IF NOT EXISTS "thesis_export_runs_buildingId_createdAt_idx" ON "thesis_export_runs"("buildingId", "createdAt");

CREATE INDEX IF NOT EXISTS "thesis_export_runs_evalPeriodId_status_idx" ON "thesis_export_runs"("evalPeriodId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_name_key" ON "buildings"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_slug_key" ON "buildings"("slug");

CREATE INDEX IF NOT EXISTS "buildings_municipalityNumber_propertyNumber_sectionNumber_idx" ON "buildings"("municipalityNumber", "propertyNumber", "sectionNumber");

CREATE INDEX IF NOT EXISTS "buildings_municipalityNumber_propertyNumber_sectionNumber_s_idx" ON "buildings"("municipalityNumber", "propertyNumber", "sectionNumber", "shareNumber");

CREATE INDEX IF NOT EXISTS "buildings_address_postCode_idx" ON "buildings"("address", "postCode");

CREATE INDEX IF NOT EXISTS "buildings_postCode_idx" ON "buildings"("postCode");

CREATE INDEX IF NOT EXISTS "buildings_buildingCategories_idx" ON "buildings"("buildingCategories");

CREATE INDEX IF NOT EXISTS "buildings_buildingYear_idx" ON "buildings"("buildingYear");

CREATE INDEX IF NOT EXISTS "buildings_region_idx" ON "buildings"("region");

CREATE INDEX IF NOT EXISTS "buildings_selectedGridOperatorId_idx" ON "buildings"("selectedGridOperatorId");

CREATE INDEX IF NOT EXISTS "buildings_name_idx" ON "buildings"("name");

CREATE INDEX IF NOT EXISTS "buildings_slug_idx" ON "buildings"("slug");

CREATE INDEX IF NOT EXISTS "buildings_lat_idx" ON "buildings"("latitude");

CREATE INDEX IF NOT EXISTS "buildings_lon_idx" ON "buildings"("longitude");

CREATE INDEX IF NOT EXISTS "buildings_metering_topology_idx" ON "buildings"("meteringTopology");

CREATE INDEX IF NOT EXISTS "buildings_costRollupInvalidatedAt_idx" ON "buildings"("costRollupInvalidatedAt");

CREATE INDEX IF NOT EXISTS "buildings_allocationTrack_idx" ON "buildings"("allocationTrack");

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_name_address_key" ON "buildings"("name", "address");

CREATE INDEX IF NOT EXISTS "building_addresses_buildingId_idx" ON "building_addresses"("buildingId");

CREATE INDEX IF NOT EXISTS "building_addresses_normalizedAddr_postCode_idx" ON "building_addresses"("normalizedAddr", "postCode");

CREATE UNIQUE INDEX IF NOT EXISTS "building_addresses_buildingid_normalizedaddr_postcode_key" ON "building_addresses"("buildingId", "normalizedAddr", "postCode");

CREATE INDEX IF NOT EXISTS "weather_series_element_resolution_idx" ON "weather_series"("elementId", "resolution");

CREATE INDEX IF NOT EXISTS "weather_series_station_idx" ON "weather_series"("stationId");

CREATE UNIQUE INDEX IF NOT EXISTS "weather_series_unique" ON "weather_series"("stationId", "elementId", "resolution", "level");

CREATE INDEX IF NOT EXISTS "weather_observations_ref_time_idx" ON "weather_observations"("referenceTime");

CREATE INDEX IF NOT EXISTS "building_weather_station_station_idx" ON "building_weather_station"("stationId");

CREATE UNIQUE INDEX IF NOT EXISTS "metering_points_mpid_key" ON "metering_points"("mpid");

CREATE INDEX IF NOT EXISTS "metering_points_mpid_idx" ON "metering_points"("mpid");

CREATE INDEX IF NOT EXISTS "metering_points_clerkOrgId_idx" ON "metering_points"("clerkOrgId");

CREATE INDEX IF NOT EXISTS "metering_points_buildingId_idx" ON "metering_points"("buildingId");

CREATE INDEX IF NOT EXISTS "metering_points_integrationId_idx" ON "metering_points"("integrationId");

CREATE INDEX IF NOT EXISTS "metering_points_isActive_idx" ON "metering_points"("isActive");

CREATE INDEX IF NOT EXISTS "metering_points_lastFetchedAt_idx" ON "metering_points"("lastFetchedAt");

CREATE INDEX IF NOT EXISTS "metering_points_firstObservationAt_idx" ON "metering_points"("firstObservationAt");

CREATE INDEX IF NOT EXISTS "metering_points_lastObservationAt_idx" ON "metering_points"("lastObservationAt");

CREATE INDEX IF NOT EXISTS "metering_points_backfillState_idx" ON "metering_points"("backfillState");

CREATE INDEX IF NOT EXISTS "metering_points_backfillNextRunAt_idx" ON "metering_points"("backfillNextRunAt");

CREATE INDEX IF NOT EXISTS "metering_points_apiFirstObservationAt_idx" ON "metering_points"("apiFirstObservationAt");

CREATE INDEX IF NOT EXISTS "metering_points_apiLastObservationAt_idx" ON "metering_points"("apiLastObservationAt");

CREATE INDEX IF NOT EXISTS "metering_points_parentMeteringPointId_idx" ON "metering_points"("parentMeteringPointId");

CREATE INDEX IF NOT EXISTS "metering_points_externalSubMeterId_idx" ON "metering_points"("externalSubMeterId");

CREATE INDEX IF NOT EXISTS "metering_points_isSubMeter_idx" ON "metering_points"("isSubMeter");

CREATE INDEX IF NOT EXISTS "metering_points_includeInTotal_idx" ON "metering_points"("includeInTotal");

CREATE INDEX IF NOT EXISTS "metering_points_folderId_idx" ON "metering_points"("folderId");

CREATE INDEX IF NOT EXISTS "metering_points_name_idx" ON "metering_points"("name");

CREATE INDEX IF NOT EXISTS "metering_points_org_buildingid_idx" ON "metering_points"("clerkOrgId", "buildingId");

CREATE INDEX IF NOT EXISTS "metering_points_org_isactive_idx" ON "metering_points"("clerkOrgId", "isActive");

CREATE INDEX IF NOT EXISTS "metering_points_org_lastobservationat_idx" ON "metering_points"("clerkOrgId", "lastObservationAt");

CREATE INDEX IF NOT EXISTS "metering_points_org_type_idx" ON "metering_points"("clerkOrgId", "type");

CREATE INDEX IF NOT EXISTS "metering_points_type_isactive_idx" ON "metering_points"("type", "isActive");

CREATE INDEX IF NOT EXISTS "metering_points_org_type_isactive_idx" ON "metering_points"("clerkOrgId", "type", "isActive");

CREATE INDEX IF NOT EXISTS "metering_points_type_lastobs_idx" ON "metering_points"("type", "lastObservationAt");

CREATE INDEX IF NOT EXISTS "mp_active_lastobs_id_idx" ON "metering_points"("isActive", "lastObservationAt", "id");

CREATE INDEX IF NOT EXISTS "metering_points_flow_stage_idx" ON "metering_points"("flowStage");

CREATE INDEX IF NOT EXISTS "metering_points_hierarchy_role_idx" ON "metering_points"("hierarchyRole");

CREATE INDEX IF NOT EXISTS "metering_points_ct_placement_idx" ON "metering_points"("ctPlacement");

CREATE INDEX IF NOT EXISTS "metering_points_energy_sourced_from_idx" ON "metering_points"("energySourcedFromId");

CREATE INDEX IF NOT EXISTS "metering_points_building_flow_stage_idx" ON "metering_points"("buildingId", "flowStage");

CREATE INDEX IF NOT EXISTS "mpp_meteringpoint_idx" ON "metering_point_placements"("meteringPointId");

CREATE INDEX IF NOT EXISTS "mpp_areaplanversion_idx" ON "metering_point_placements"("areaPlanVersionId");

CREATE INDEX IF NOT EXISTS "mpp_areasnapshot_idx" ON "metering_point_placements"("areaSpaceSnapshotId");

CREATE INDEX IF NOT EXISTS "mpp_floorplan_idx" ON "metering_point_placements"("floorPlanId");

CREATE INDEX IF NOT EXISTS "metering_point_to_buildings_meteringPointId_idx" ON "metering_point_to_buildings"("meteringPointId");

CREATE INDEX IF NOT EXISTS "metering_point_to_buildings_buildingId_idx" ON "metering_point_to_buildings"("buildingId");

CREATE UNIQUE INDEX IF NOT EXISTS "metering_point_to_buildings_unique" ON "metering_point_to_buildings"("meteringPointId", "buildingId");

CREATE INDEX IF NOT EXISTS "observations_meteringPointId_idx" ON "observations"("meteringPointId");

CREATE INDEX IF NOT EXISTS "observations_time_idx" ON "observations"("time");

CREATE INDEX IF NOT EXISTS "observations_utcTime_idx" ON "observations"("utcTime");

CREATE INDEX IF NOT EXISTS "observations_meteringPointId_time_idx" ON "observations"("meteringPointId", "time");

CREATE INDEX IF NOT EXISTS "observations_meteringPointId_utcTime_idx" ON "observations"("meteringPointId", "utcTime");

CREATE INDEX IF NOT EXISTS "observations_meteringPointId_time_volume_kwh_idx" ON "observations"("meteringPointId", "time", "volume_kwh");

CREATE UNIQUE INDEX IF NOT EXISTS "observations_meteringPointId_utcTime_key" ON "observations"("meteringPointId", "utcTime");

CREATE INDEX IF NOT EXISTS "accumulated_observations_meteringPointId_sourceTimestampPar_idx" ON "accumulated_observations"("meteringPointId", "sourceTimestampParsed");

CREATE INDEX IF NOT EXISTS "accumulated_observations_importPlaceholderMeterId_sourceTim_idx" ON "accumulated_observations"("importPlaceholderMeterId", "sourceTimestampParsed");

CREATE INDEX IF NOT EXISTS "accumulated_observations_source_idx" ON "accumulated_observations"("source");

CREATE INDEX IF NOT EXISTS "accumulated_observations_createdAt_idx" ON "accumulated_observations"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "accumulated_observations_meteringPointId_sourceTimestampRaw_key" ON "accumulated_observations"("meteringPointId", "sourceTimestampRaw");

CREATE UNIQUE INDEX IF NOT EXISTS "accumulated_observations_importPlaceholderMeterId_sourceTim_key" ON "accumulated_observations"("importPlaceholderMeterId", "sourceTimestampRaw");

CREATE INDEX IF NOT EXISTS "district_heating_measurements_meteringPointId_time_idx" ON "district_heating_measurements"("meteringPointId", "time");

CREATE INDEX IF NOT EXISTS "district_heating_measurements_meteringPointId_resolution_idx" ON "district_heating_measurements"("meteringPointId", "resolution");

CREATE INDEX IF NOT EXISTS "district_heating_measurements_time_idx" ON "district_heating_measurements"("time");

CREATE INDEX IF NOT EXISTS "district_heating_measurements_utcTime_idx" ON "district_heating_measurements"("utcTime");

CREATE UNIQUE INDEX IF NOT EXISTS "district_heating_measurements_meteringPointId_utcTime_key" ON "district_heating_measurements"("meteringPointId", "utcTime");

CREATE INDEX IF NOT EXISTS "daily_energy_prices_date_idx" ON "daily_energy_prices"("date");

CREATE INDEX IF NOT EXISTS "daily_energy_prices_areaCode_idx" ON "daily_energy_prices"("areaCode");

CREATE INDEX IF NOT EXISTS "daily_energy_prices_date_areaCode_averagePrice_idx" ON "daily_energy_prices"("date", "areaCode", "averagePrice");

CREATE INDEX IF NOT EXISTS "daily_energy_prices_date_area_idx" ON "daily_energy_prices"("date", "areaCode");

CREATE INDEX IF NOT EXISTS "daily_energy_prices_updatedAt_idx" ON "daily_energy_prices"("updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "daily_energy_prices_date_areaCode_key" ON "daily_energy_prices"("date", "areaCode");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_date_hour_idx" ON "hourly_energy_prices"("date", "hour");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_areaCode_idx" ON "hourly_energy_prices"("areaCode");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_date_areaCode_idx" ON "hourly_energy_prices"("date", "areaCode");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_area_date_price_idx" ON "hourly_energy_prices"("areaCode", "date", "price");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_date_hour_areaCode_price_idx" ON "hourly_energy_prices"("date", "hour", "areaCode", "price");

CREATE INDEX IF NOT EXISTS "hourly_energy_prices_updatedAt_idx" ON "hourly_energy_prices"("updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "hourly_energy_prices_date_hour_areaCode_key" ON "hourly_energy_prices"("date", "hour", "areaCode");

CREATE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_date_hour_quarter_idx" ON "quarter_hourly_energy_prices"("date", "hour", "quarter");

CREATE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_areaCode_idx" ON "quarter_hourly_energy_prices"("areaCode");

CREATE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_date_areaCode_idx" ON "quarter_hourly_energy_prices"("date", "areaCode");

CREATE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_area_date_price_idx" ON "quarter_hourly_energy_prices"("areaCode", "date", "price");

CREATE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_updatedAt_idx" ON "quarter_hourly_energy_prices"("updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "quarter_hourly_energy_prices_date_hour_quarter_areaCode_key" ON "quarter_hourly_energy_prices"("date", "hour", "quarter", "areaCode");

CREATE UNIQUE INDEX IF NOT EXISTS "grid_operators_name_key" ON "grid_operators"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "grid_operators_organizationNumber_key" ON "grid_operators"("organizationNumber");

CREATE INDEX IF NOT EXISTS "grid_operators_organizationNumber_idx" ON "grid_operators"("organizationNumber");

CREATE INDEX IF NOT EXISTS "grid_tariffs_gridOperatorId_idx" ON "grid_tariffs"("gridOperatorId");

CREATE INDEX IF NOT EXISTS "grid_tariffs_county_idx" ON "grid_tariffs"("county");

CREATE INDEX IF NOT EXISTS "grid_tariffs_timestamp_idx" ON "grid_tariffs"("timestamp");

CREATE INDEX IF NOT EXISTS "grid_tariffs_powerStageFromKw_powerstageToKw_idx" ON "grid_tariffs"("powerStageFromKw", "powerstageToKw");

CREATE UNIQUE INDEX IF NOT EXISTS "grid_tariffs_gridOperatorId_county_timestamp_tariffGroup_po_key" ON "grid_tariffs"("gridOperatorId", "county", "timestamp", "tariffGroup", "powerStageFromKw", "powerstageToKw");

CREATE INDEX IF NOT EXISTS "building_hourly_cost_cache_buildingId_idx" ON "building_hourly_cost_cache"("buildingId");

CREATE INDEX IF NOT EXISTS "building_hourly_cost_cache_hour_idx" ON "building_hourly_cost_cache"("hour");

CREATE INDEX IF NOT EXISTS "bhcc_building_hour_idx" ON "building_hourly_cost_cache"("buildingId", "hour");

CREATE INDEX IF NOT EXISTS "building_hourly_cost_cache_calculatedAt_idx" ON "building_hourly_cost_cache"("calculatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "building_hourly_cost_cache_buildingId_hour_key" ON "building_hourly_cost_cache"("buildingId", "hour");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_to_users_organizationId_fkey') THEN
    ALTER TABLE "organization_to_users" ADD CONSTRAINT "organization_to_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_to_users_userId_fkey') THEN
    ALTER TABLE "organization_to_users" ADD CONSTRAINT "organization_to_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrations_organizationId_fkey') THEN
    ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_sources_integrationId_fkey') THEN
    ALTER TABLE "infraspawn_sources" ADD CONSTRAINT "infraspawn_sources_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_sources_organizationId_fkey') THEN
    ALTER TABLE "infraspawn_sources" ADD CONSTRAINT "infraspawn_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_sources_buildingId_fkey') THEN
    ALTER TABLE "infraspawn_sources" ADD CONSTRAINT "infraspawn_sources_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_bacnet_point_meta_sourceId_fkey') THEN
    ALTER TABLE "infraspawn_bacnet_point_meta" ADD CONSTRAINT "infraspawn_bacnet_point_meta_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "infraspawn_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_bacnet_samples_sourceId_fkey') THEN
    ALTER TABLE "infraspawn_bacnet_samples" ADD CONSTRAINT "infraspawn_bacnet_samples_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "infraspawn_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_sync_states_sourceId_fkey') THEN
    ALTER TABLE "infraspawn_sync_states" ADD CONSTRAINT "infraspawn_sync_states_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "infraspawn_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_alarm_events_sourceId_fkey') THEN
    ALTER TABLE "infraspawn_alarm_events" ADD CONSTRAINT "infraspawn_alarm_events_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "infraspawn_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infraspawn_alarm_events_buildingId_fkey') THEN
    ALTER TABLE "infraspawn_alarm_events" ADD CONSTRAINT "infraspawn_alarm_events_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_site_profiles_buildingId_fkey') THEN
    ALTER TABLE "sd_anlegg_site_profiles" ADD CONSTRAINT "sd_anlegg_site_profiles_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_control_simulation_runs_buildingId_fkey') THEN
    ALTER TABLE "sd_anlegg_control_simulation_runs" ADD CONSTRAINT "sd_anlegg_control_simulation_runs_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_control_simulation_runs_planId_fkey') THEN
    ALTER TABLE "sd_anlegg_control_simulation_runs" ADD CONSTRAINT "sd_anlegg_control_simulation_runs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sd_anlegg_control_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_control_plans_buildingId_fkey') THEN
    ALTER TABLE "sd_anlegg_control_plans" ADD CONSTRAINT "sd_anlegg_control_plans_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_control_plan_hours_planId_fkey') THEN
    ALTER TABLE "sd_anlegg_control_plan_hours" ADD CONSTRAINT "sd_anlegg_control_plan_hours_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sd_anlegg_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_control_reconcile_hours_planHourId_fkey') THEN
    ALTER TABLE "sd_anlegg_control_reconcile_hours" ADD CONSTRAINT "sd_anlegg_control_reconcile_hours_planHourId_fkey" FOREIGN KEY ("planHourId") REFERENCES "sd_anlegg_control_plan_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sd_anlegg_mpc_pipeline_runs_buildingId_fkey') THEN
    ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD CONSTRAINT "sd_anlegg_mpc_pipeline_runs_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thesis_eval_periods_buildingId_fkey') THEN
    ALTER TABLE "thesis_eval_periods" ADD CONSTRAINT "thesis_eval_periods_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thesis_export_runs_buildingId_fkey') THEN
    ALTER TABLE "thesis_export_runs" ADD CONSTRAINT "thesis_export_runs_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thesis_export_runs_evalPeriodId_fkey') THEN
    ALTER TABLE "thesis_export_runs" ADD CONSTRAINT "thesis_export_runs_evalPeriodId_fkey" FOREIGN KEY ("evalPeriodId") REFERENCES "thesis_eval_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buildings_selectedGridOperatorId_fkey') THEN
    ALTER TABLE "buildings" ADD CONSTRAINT "buildings_selectedGridOperatorId_fkey" FOREIGN KEY ("selectedGridOperatorId") REFERENCES "grid_operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'building_addresses_buildingId_fkey') THEN
    ALTER TABLE "building_addresses" ADD CONSTRAINT "building_addresses_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weather_series_station_fk') THEN
    ALTER TABLE "weather_series" ADD CONSTRAINT "weather_series_station_fk" FOREIGN KEY ("stationId") REFERENCES "weather_stations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weather_observations_series_fk') THEN
    ALTER TABLE "weather_observations" ADD CONSTRAINT "weather_observations_series_fk" FOREIGN KEY ("seriesId") REFERENCES "weather_series"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'building_weather_station_building_fk') THEN
    ALTER TABLE "building_weather_station" ADD CONSTRAINT "building_weather_station_building_fk" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'building_weather_station_station_fk') THEN
    ALTER TABLE "building_weather_station" ADD CONSTRAINT "building_weather_station_station_fk" FOREIGN KEY ("stationId") REFERENCES "weather_stations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_energySourcedFromId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_energySourcedFromId_fkey" FOREIGN KEY ("energySourcedFromId") REFERENCES "metering_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_classifiedByUserId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_classifiedByUserId_fkey" FOREIGN KEY ("classifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_buildingId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_clerkOrgId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_clerkOrgId_fkey" FOREIGN KEY ("clerkOrgId") REFERENCES "organizations"("clerkOrgId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_integrationId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_points_parentMeteringPointId_fkey') THEN
    ALTER TABLE "metering_points" ADD CONSTRAINT "metering_points_parentMeteringPointId_fkey" FOREIGN KEY ("parentMeteringPointId") REFERENCES "metering_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_point_placements_meteringPointId_fkey') THEN
    ALTER TABLE "metering_point_placements" ADD CONSTRAINT "metering_point_placements_meteringPointId_fkey" FOREIGN KEY ("meteringPointId") REFERENCES "metering_points"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_point_to_buildings_buildingId_fkey') THEN
    ALTER TABLE "metering_point_to_buildings" ADD CONSTRAINT "metering_point_to_buildings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metering_point_to_buildings_meteringPointId_fkey') THEN
    ALTER TABLE "metering_point_to_buildings" ADD CONSTRAINT "metering_point_to_buildings_meteringPointId_fkey" FOREIGN KEY ("meteringPointId") REFERENCES "metering_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_meteringPointId_fkey') THEN
    ALTER TABLE "observations" ADD CONSTRAINT "observations_meteringPointId_fkey" FOREIGN KEY ("meteringPointId") REFERENCES "metering_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_reviewedByUserId_fkey') THEN
    ALTER TABLE "observations" ADD CONSTRAINT "observations_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accumulated_observations_meteringPointId_fkey') THEN
    ALTER TABLE "accumulated_observations" ADD CONSTRAINT "accumulated_observations_meteringPointId_fkey" FOREIGN KEY ("meteringPointId") REFERENCES "metering_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'district_heating_measurements_meteringPointId_fkey') THEN
    ALTER TABLE "district_heating_measurements" ADD CONSTRAINT "district_heating_measurements_meteringPointId_fkey" FOREIGN KEY ("meteringPointId") REFERENCES "metering_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grid_tariffs_gridOperatorId_fkey') THEN
    ALTER TABLE "grid_tariffs" ADD CONSTRAINT "grid_tariffs_gridOperatorId_fkey" FOREIGN KEY ("gridOperatorId") REFERENCES "grid_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'building_hourly_cost_cache_buildingId_fkey') THEN
    ALTER TABLE "building_hourly_cost_cache" ADD CONSTRAINT "building_hourly_cost_cache_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
