"use client";

import { ResourceCrudPage } from "@/components/master-data/resource-crud-page";
import type { Unit } from "@/lib/types";

export default function UnitsPage() {
  return (
    <ResourceCrudPage<Unit>
      title="Units"
      endpoint="/units"
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "abbreviation", label: "Abbreviation", required: true },
        { name: "conversionFactor", label: "Conversion Factor", type: "number" },
      ]}
      nameField="name"
      subtitleField="code"
      columns={[{ key: "abbreviation", label: "Abbr." }]}
    />
  );
}
