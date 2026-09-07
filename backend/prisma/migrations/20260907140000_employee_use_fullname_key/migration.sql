-- DropIndex
DROP INDEX "employees_employee_code_key";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "employee_code",
DROP COLUMN "phone";

-- CreateIndex
CREATE UNIQUE INDEX "employees_fullname_key" ON "employees"("fullname");
