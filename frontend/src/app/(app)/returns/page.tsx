"use client";

import { DocumentList } from "@/components/operations/document-list";
import { ReturnCreateForm } from "@/components/operations/return-create-form";
import type { ReturnDoc } from "@/lib/types";

export default function ReturnsListPage() {
  return (
    <DocumentList<ReturnDoc>
      title="Returns"
      endpoint="/returns"
      detailBasePath="/returns"
      docNoColumn={(r) => r.returnNo}
      dialogClassName="max-w-3xl"
      statusOptions={["DRAFT", "RECEIVED", "CANCELLED"]}
      renderCreateForm={(close) => <ReturnCreateForm onClose={close} />}
      columns={[
        { key: "department", label: "Department", render: (r) => r.department?.name ?? "-" },
        { key: "reason", label: "Reason", render: (r) => r.reason ?? "-" },
        { key: "items", label: "Lines", render: (r) => r.items.length },
      ]}
    />
  );
}
