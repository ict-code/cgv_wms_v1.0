"use client";

import { ResourceCrudPage } from "@/components/master-data/resource-crud-page";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  return (
    <ResourceCrudPage<Category>
      title="Categories"
      endpoint="/categories"
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
      ]}
      nameField="name"
      subtitleField="code"
      columns={[]}
    />
  );
}
