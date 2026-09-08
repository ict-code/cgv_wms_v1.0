export const MODULE_KEYS = [
  'items', 'inventory', 'scan',
  'receiving', 'issuance', 'transfers', 'returns', 'adjustments', 'stock-counts',
  'categories', 'units', 'suppliers', 'warehouses', 'locations', 'departments', 'employees',
  'reports',
  'users', 'roles',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
