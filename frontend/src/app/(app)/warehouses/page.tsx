"use client";

import { ResourceCrudPage } from "@/components/master-data/resource-crud-page";
import type { Warehouse } from "@/lib/types";

export default function WarehousesPage() {
  return (
    <ResourceCrudPage<Warehouse>
      title="Warehouses"
      endpoint="/warehouses"
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "address", label: "Address" },
      ]}
      nameField="name"
      subtitleField="code"
      columns={[{ key: "address", label: "Address" }]}
    />
  );
}
