export const AppRole = {
  ADMINISTRATOR: 'Administrator',
  WAREHOUSE_MANAGER: 'Warehouse Manager',
  WAREHOUSE_STAFF: 'Warehouse Staff',
  INVENTORY_CONTROLLER: 'Inventory Controller',
  REQUESTER: 'Requester',
  AUDITOR: 'Auditor',
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];
