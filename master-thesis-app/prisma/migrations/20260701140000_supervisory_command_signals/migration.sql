ALTER TABLE "sd_anlegg_supervisory_commands"
  ADD COLUMN IF NOT EXISTS "signals" JSONB;
