-- Explicit order within a week section; backfilled from creation order so existing courses look unchanged.
ALTER TABLE "topics" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "topics" SET "position" = "id";
