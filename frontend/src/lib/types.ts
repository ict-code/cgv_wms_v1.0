export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  modules: string[];
}

export interface Department {
  id: string;
  code: string;
  name: string;
  departmentHeadId: string | null;
  status: "ACTIVE" | "INACTIVE";
  departmentHead?: Employee | null;
}

export interface Employee {
  id: string;
  fullname: string;
  employeeIdNumber: string | null;
  departmentId: string | null;
  position: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  department?: Department | null;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export type LocationType = "ZONE" | "RACK" | "SHELF" | "BIN" | "FLOOR" | "STAGING" | "RECEIVING" | "DISPATCH" | "QUARANTINE" | "STORAGE";

export interface Location {
  id: string;
  warehouseId: string;
  parentLocationId: string | null;
  code: string;
  name: string;
  locationType: LocationType;
  status: "ACTIVE" | "INACTIVE";
  warehouse?: Warehouse;
}

export type StorageItemType = "DOCUMENT_BOX" | "FURNITURE" | "EQUIPMENT" | "OTHER";
export type StorageItemStatus = "STORED" | "RETRIEVED" | "DISPOSED";

export interface StorageItem {
  id: string;
  code: string;
  description: string;
  itemType: StorageItemType;
  quantity: number;
  photoFilename: string | null;
  locationId: string;
  ownerDepartmentId: string | null;
  custodianId: string | null;
  dateStored: string;
  disposalDueDate: string | null;
  status: StorageItemStatus;
  retrievedAt: string | null;
  disposedAt: string | null;
  notes: string | null;
  location?: Location;
  ownerDepartment?: Department | null;
  custodian?: Employee | null;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  conversionFactor: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface Item {
  id: string;
  itemCode: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  unitId: string;
  brand: string | null;
  model: string | null;
  reorderLevel: string;
  maximumStock: string | null;
  standardCost: string;
  trackSerial: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  status: "ACTIVE" | "INACTIVE";
  category?: Category;
  unit?: Unit;
}

export interface InventoryBalance {
  id: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  updatedAt: string;
  item?: Item;
  warehouse?: Warehouse;
  location?: Location;
}

export interface InventoryTransaction {
  id: string;
  transactionNo: string;
  transactionType: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
  referenceType: string;
  referenceId: string;
  expiryDate: string | null;
  createdAt: string;
  item?: Item;
  warehouse?: Warehouse;
  location?: Location;
  performedByUser?: { fullname: string };
}

export interface User {
  id: string;
  username: string;
  fullname: string;
  email: string;
  roleId: string;
  departmentId: string | null;
  status: "ACTIVE" | "INACTIVE";
  role?: Role;
  department?: Department;
}

export interface ReceivingItem {
  id: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  locationId: string;
  batchNo: string | null;
  serialNo: string | null;
  expiryDate: string | null;
  item?: Item;
  location?: Location;
}

export interface Receiving {
  id: string;
  receivingNo: string;
  supplierId: string;
  warehouseId: string;
  purchaseReference: string | null;
  deliveryReference: string | null;
  receivedAt: string | null;
  status: "DRAFT" | "PENDING" | "RECEIVED" | "CANCELLED";
  remarks: string | null;
  createdAt: string;
  supplier?: Supplier;
  warehouse?: Warehouse;
  items: ReceivingItem[];
}

export interface IssuanceItem {
  id: string;
  itemId: string;
  quantityRequested: string;
  quantityIssued: string | null;
  unitCost: string;
  locationId: string;
  item?: Item;
  location?: Location;
}

export interface Issuance {
  id: string;
  issuanceNo: string;
  requestingDepartmentId: string;
  employeeId: string | null;
  warehouseId: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ISSUED" | "CANCELLED" | "REJECTED";
  purpose: string | null;
  remarks: string | null;
  createdAt: string;
  requestingDepartment?: Department;
  employee?: Employee | null;
  warehouse?: Warehouse;
  items: IssuanceItem[];
}

export interface TransferItem {
  id: string;
  itemId: string;
  quantity: string;
  batchNo: string | null;
  serialNo: string | null;
  item?: Item;
}

export interface Transfer {
  id: string;
  transferNo: string;
  warehouseId: string;
  fromLocationId: string;
  toLocationId: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  remarks: string | null;
  createdAt: string;
  warehouse?: Warehouse;
  fromLocation?: Location;
  toLocation?: Location;
  items: TransferItem[];
}

export interface ReturnItem {
  id: string;
  itemId: string;
  quantity: string;
  locationId: string;
  item?: Item;
  location?: Location;
}

export interface ReturnDoc {
  id: string;
  returnNo: string;
  originalIssuanceId: string | null;
  departmentId: string;
  warehouseId: string;
  reason: string | null;
  status: "DRAFT" | "RECEIVED" | "CANCELLED";
  createdAt: string;
  department?: Department;
  warehouse?: Warehouse;
  items: ReturnItem[];
}

export interface AdjustmentItem {
  id: string;
  itemId: string;
  locationId: string;
  quantity: string;
  adjustmentType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  item?: Item;
  location?: Location;
}

export interface Adjustment {
  id: string;
  adjustmentNo: string;
  warehouseId: string;
  reason: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "POSTED" | "CANCELLED" | "REJECTED";
  remarks: string | null;
  createdAt: string;
  warehouse?: Warehouse;
  items: AdjustmentItem[];
}

export interface StockCountItem {
  id: string;
  itemId: string;
  systemQuantity: string;
  physicalQuantity: string;
  variance: string;
  remarks: string | null;
  item?: Item;
}

export interface StockCount {
  id: string;
  countNo: string;
  warehouseId: string;
  locationId: string;
  status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "REVIEWED" | "APPROVED" | "CANCELLED";
  startedAt: string | null;
  completedAt: string | null;
  remarks: string | null;
  createdAt: string;
  warehouse?: Warehouse;
  location?: Location;
  items: StockCountItem[];
}

export interface DashboardData {
  inventory: {
    totalItems: number;
    totalQuantity: string;
    lowStockCount: number;
    outOfStockCount: number;
    expiringCount: number;
    recentlyReceived: InventoryTransaction[];
    recentlyIssued: InventoryTransaction[];
    recentAdjustments: InventoryTransaction[];
  };
  operations: {
    pendingReceiving: number;
    pendingIssuance: number;
    pendingApprovals: number;
    pendingStockCounts: number;
    recentTransfers: Transfer[];
  };
  alerts: {
    lowStock: { item: Item; warehouseId: string; totalAvailable: string }[];
    outOfStock: { item: Item; warehouseId: string; totalAvailable: string }[];
    expiring: InventoryTransaction[];
  };
}

export type NotificationType =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "EXPIRING_SOON"
  | "RECEIVING_COMPLETED"
  | "ISSUANCE_APPROVED"
  | "ISSUANCE_REJECTED"
  | "ISSUANCE_ISSUED"
  | "TRANSFER_COMPLETED"
  | "STOCK_COUNT_DISCREPANCY"
  | "ADJUSTMENT_PENDING_APPROVAL";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  referenceNo: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse extends Paginated<AppNotification> {
  unreadCount: number;
}
