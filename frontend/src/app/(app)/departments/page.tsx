"use client";

import { ResourceCrudPage } from "@/components/master-data/resource-crud-page";
import { useEmployees } from "@/hooks/use-reference-data";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const { data: employees } = useEmployees();

  return (
    <ResourceCrudPage<Department>
      title="Departments"
      endpoint="/departments"
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        {
          name: "departmentHeadId",
          label: "Department Head",
          type: "select",
          emptyOptionLabel: "None",
          options: employees?.data.map((e) => ({ value: e.id, label: e.fullname })) ?? [],
        },
      ]}
      nameField="name"
      subtitleField="code"
      columns={[{ key: "departmentHead", label: "Department Head", render: (d) => d.departmentHead?.fullname ?? "-" }]}
    />
  );
}
