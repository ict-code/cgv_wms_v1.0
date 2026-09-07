"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Pencil, Power, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Employee } from "@/lib/types";
import { useDepartments, useEmployees } from "@/hooks/use-reference-data";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Pagination } from "@/components/ui/pagination";
import { Dialog } from "@/components/ui/dialog";
import { ImportExportBar } from "@/components/master-data/import-export-bar";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { TableCard } from "@/components/ui/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const schema = z.object({
  employeeCode: z.string().min(1, "Required"),
  fullname: z.string().min(1, "Required"),
  departmentId: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [editingEmployee, setEditingEmployee] = useState<Employee | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { register, control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isOpen = editingEmployee !== undefined;

  const { data: departments } = useDepartments();
  const { data, isLoading } = useEmployees();

  const filtered = useMemo(() => {
    let rows = data?.data ?? [];
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (departmentFilter) rows = rows.filter((r) => r.departmentId === departmentFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.fullname.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, statusFilter, departmentFilter]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered, `${search}|${statusFilter}|${departmentFilter}`);

  function openCreate() {
    reset({ employeeCode: "", fullname: "", departmentId: "", position: "", email: "", phone: "" });
    setError(null);
    setEditingEmployee(null);
  }

  function openEdit(employee: Employee) {
    reset({
      employeeCode: employee.employeeCode,
      fullname: employee.fullname,
      departmentId: employee.departmentId ?? "",
      position: employee.position ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
    });
    setError(null);
    setEditingEmployee(employee);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
      if (editingEmployee) return (await apiClient.patch(`/employees/${editingEmployee.id}`, payload)).data;
      return (await apiClient.post("/employees", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/employees"] });
      setEditingEmployee(undefined);
      setError(null);
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to save") : "Failed to save";
      setError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      await apiClient.patch(`/employees/${employee.id}`, { status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/employees"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      await apiClient.delete(`/employees/${employee.id}`);
    },
    onSuccess: (_data, employee) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(employee.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/employees"] });
    },
    onError: (err) => {
      const message = err instanceof AxiosError ? (err.response?.data?.message ?? "Failed to delete") : "Failed to delete";
      setActionError(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  function handleDelete(employee: Employee) {
    if (!window.confirm(`Delete "${employee.fullname}"? This cannot be undone.`)) return;
    deleteMutation.mutate(employee);
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected employee(s)? This cannot be undone.`)) return;
    setActionError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/employees/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) setActionError(`${failed} of ${ids.length} could not be deleted (still referenced elsewhere).`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["/employees"] });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of paged) {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <div className="flex items-center gap-2">
          <ImportExportBar endpoint="/employees" resourceName="employees" onImported={() => queryClient.invalidateQueries({ queryKey: ["/employees"] })} />
          <Button onClick={openCreate}>New Employee</Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setEditingEmployee(undefined)} title={editingEmployee ? "Edit Employee" : "New Employee"}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeCode">Employee Code *</Label>
            <Input id="employeeCode" {...register("employeeCode")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullname">Full Name *</Label>
            <Input id="fullname" {...register("fullname")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="departmentId">Department</Label>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Combobox
                  id="departmentId"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select department"
                  emptyOptionLabel="None"
                  options={departments?.data.map((d) => ({ value: d.id, label: d.name })) ?? []}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="position">Position</Label>
            <Input id="position" {...register("position")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TableCard
        title="Employees"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employees..."
        filterActive={statusFilter !== "ALL" || !!departmentFilter}
        filterContent={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">All</option>
                {departments?.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        headerExtra={
          selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selected.size})
            </Button>
          )
        }
      >
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
          <Table bare>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                    checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-[#206bc4]"
                      checked={selected.has(employee.id)}
                      onChange={() => toggleRow(employee.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={employee.fullname} />
                      <div>
                        <p className="font-medium text-foreground">{employee.fullname}</p>
                        <p className="text-xs text-[var(--color-muted)]">{employee.employeeCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.department?.name ?? "-"}</TableCell>
                  <TableCell>{employee.position ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={employee.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton icon={Pencil} title="Edit" onClick={() => openEdit(employee)} />
                      <IconButton
                        icon={Power}
                        title={employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        onClick={() => toggleStatusMutation.mutate(employee)}
                        disabled={toggleStatusMutation.isPending}
                      />
                      <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => handleDelete(employee)} disabled={deleteMutation.isPending} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    No employees found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
          </>
        )}
      </TableCard>
    </div>
  );
}
