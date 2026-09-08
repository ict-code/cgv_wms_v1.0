-- AlterEnum
ALTER TYPE "LocationType" ADD VALUE 'STORAGE';

-- CreateEnum
CREATE TYPE "StorageItemType" AS ENUM ('DOCUMENT_BOX', 'FURNITURE', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageItemStatus" AS ENUM ('STORED', 'RETRIEVED', 'DISPOSED');

-- CreateTable
CREATE TABLE "storage_items" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "item_type" "StorageItemType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "location_id" UUID NOT NULL,
    "owner_department_id" UUID,
    "custodian_id" UUID,
    "date_stored" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposal_due_date" DATE,
    "status" "StorageItemStatus" NOT NULL DEFAULT 'STORED',
    "retrieved_at" TIMESTAMP(3),
    "disposed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "storage_items" ADD CONSTRAINT "storage_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_items" ADD CONSTRAINT "storage_items_owner_department_id_fkey" FOREIGN KEY ("owner_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_items" ADD CONSTRAINT "storage_items_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grant the new module to Administrator only. Warehouse Manager/Staff are left
-- untouched since the live roles table may already reflect admin customization
-- made through the Roles UI since the last deploy — the admin can grant this
-- module to any other role themselves in a few seconds.
UPDATE "roles" SET "modules" = array_append("modules", 'storage-items')
WHERE "name" = 'Administrator' AND NOT ('storage-items' = ANY("modules"));
