"use client";

import { ResourceCrudPage } from "@/components/master-data/resource-crud-page";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  return (
    <ResourceCrudPage<Supplier>
      title="Suppliers"
      endpoint="/suppliers"
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "contactPerson", label: "Contact Person" },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
      ]}
      nameField="name"
      subtitleField="code"
      columns={[
        { key: "contactPerson", label: "Contact" },
        { key: "phone", label: "Phone" },
      ]}
    />
  );
}
