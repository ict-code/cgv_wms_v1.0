-- AlterTable
ALTER TABLE "employees" ADD COLUMN "employee_id_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_number_key" ON "employees"("employee_id_number");
