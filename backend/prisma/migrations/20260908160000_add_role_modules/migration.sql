-- AlterTable
ALTER TABLE "roles" ADD COLUMN "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill default module access for the 6 built-in roles, derived from their
-- existing @Roles(...)/CAN_* guard membership as of this migration. Administrator
-- must get every module so it is never locked out by the module-access guard this
-- migration enables. Any other role row (e.g. a custom role added by hand before
-- this migration ran) keeps the empty-array default and must be set via the Roles UI.
UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','receiving','issuance','transfers','returns',
  'adjustments','stock-counts','categories','units','suppliers','warehouses',
  'locations','departments','employees','reports','users','roles'
] WHERE "name" = 'Administrator';

UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','receiving','issuance','transfers','returns',
  'adjustments','stock-counts','locations','reports'
] WHERE "name" = 'Warehouse Manager';

UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','receiving','issuance','transfers','returns','stock-counts'
] WHERE "name" = 'Warehouse Staff';

UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','adjustments','stock-counts','reports'
] WHERE "name" = 'Inventory Controller';

UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','issuance'
] WHERE "name" = 'Requester';

UPDATE "roles" SET "modules" = ARRAY[
  'items','inventory','scan','reports'
] WHERE "name" = 'Auditor';
