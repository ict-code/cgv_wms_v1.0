-- AlterTable
ALTER TABLE "storage_items" ADD COLUMN "code" TEXT;
ALTER TABLE "storage_items" ADD COLUMN "photo_filename" TEXT;

-- Reuse the same concurrency-safe document numbering scheme as
-- Receiving/Stock Count (see 20260101000001_doc_numbering_and_checks):
-- generate_doc_no('STG', 'seq_storage_no') -> STG-2026-000001.
CREATE SEQUENCE IF NOT EXISTS "seq_storage_no";

-- Backfill any rows created before this migration (safe no-op on an empty table).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM storage_items WHERE code IS NULL LOOP
    UPDATE storage_items SET code = generate_doc_no('STG', 'seq_storage_no') WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "storage_items" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "storage_items_code_key" ON "storage_items"("code");
