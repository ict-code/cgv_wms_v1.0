"use client";

import { DocumentList } from "@/components/operations/document-list";
import { IssuanceCreateForm } from "@/components/operations/issuance-create-form";
import type { Issuance } from "@/lib/types";

export default function IssuanceListPage() {
  return (
    <DocumentList<Issuance>
      title="Issuance"
      endpoint="/issuances"
      detailBasePath="/issuance"
      docNoColumn={(i) => i.issuanceNo}
      dialogClassName="max-w-3xl"
      statusOptions={["DRAFT", "PENDING_APPROVAL", "APPROVED", "ISSUED", "CANCELLED", "REJECTED"]}
      renderCreateForm={(close) => <IssuanceCreateForm onClose={close} />}
      columns={[
        { key: "department", label: "Department", render: (i) => i.requestingDepartment?.name ?? "-" },
        { key: "employee", label: "Issued To", render: (i) => i.employee?.fullname ?? "-" },
        { key: "warehouse", label: "Warehouse", render: (i) => i.warehouse?.name ?? "-" },
        { key: "items", label: "Lines", render: (i) => i.items.length },
      ]}
    />
  );
}
