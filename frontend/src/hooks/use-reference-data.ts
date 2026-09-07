import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Department, Employee, Item, Location, Paginated, Supplier, Warehouse } from "@/lib/types";

export function useWarehouses() {
  return useQuery({
    queryKey: ["/warehouses"],
    queryFn: async () => (await apiClient.get<Paginated<Warehouse>>("/warehouses", { params: { pageSize: 100 } })).data,
  });
}

export function useLocations(warehouseId?: string) {
  return useQuery({
    queryKey: ["/locations", warehouseId],
    queryFn: async () => (await apiClient.get<Paginated<Location>>("/locations", { params: { warehouseId, pageSize: 200 } })).data,
    enabled: !!warehouseId,
  });
}

export function useItems() {
  return useQuery({
    queryKey: ["/items", "all"],
    queryFn: async () => (await apiClient.get<Paginated<Item>>("/items", { params: { pageSize: 500 } })).data,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["/suppliers"],
    queryFn: async () => (await apiClient.get<Paginated<Supplier>>("/suppliers", { params: { pageSize: 100 } })).data,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["/departments"],
    queryFn: async () => (await apiClient.get<Paginated<Department>>("/departments", { params: { pageSize: 100 } })).data,
  });
}

export function useEmployees(departmentId?: string) {
  return useQuery({
    queryKey: ["/employees", departmentId],
    queryFn: async () => (await apiClient.get<Paginated<Employee>>("/employees", { params: { departmentId, pageSize: 300 } })).data,
  });
}
