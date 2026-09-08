import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Database,
  LayoutDashboard,
  MapPin,
  Package,
  PackageCheck,
  PackageMinus,
  Ruler,
  ScanLine,
  UserRound,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Undo2,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: string;
}

export interface NavSection {
  title: string | null;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { title: null, icon: LayoutDashboard, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Inventory",
    icon: Boxes,
    items: [
      { label: "Items", href: "/items", icon: Package, moduleKey: "items" },
      { label: "Current Stock", href: "/inventory", icon: Boxes, moduleKey: "inventory" },
      { label: "Barcode Lookup", href: "/scan", icon: ScanLine, moduleKey: "scan" },
    ],
  },
  {
    title: "Operations",
    icon: PackageCheck,
    items: [
      { label: "Receiving", href: "/receiving", icon: PackageCheck, moduleKey: "receiving" },
      { label: "Issuance", href: "/issuance", icon: PackageMinus, moduleKey: "issuance" },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight, moduleKey: "transfers" },
      { label: "Returns", href: "/returns", icon: Undo2, moduleKey: "returns" },
      { label: "Adjustments", href: "/adjustments", icon: SlidersHorizontal, moduleKey: "adjustments" },
      { label: "Stock Counting", href: "/stock-counts", icon: ClipboardList, moduleKey: "stock-counts" },
    ],
  },
  {
    title: "Storage",
    icon: Archive,
    items: [{ label: "Storage Items", href: "/storage-items", icon: Archive, moduleKey: "storage-items" }],
  },
  {
    title: "Master Data",
    icon: Database,
    items: [
      { label: "Categories", href: "/categories", icon: Tags, moduleKey: "categories" },
      { label: "Units", href: "/units", icon: Ruler, moduleKey: "units" },
      { label: "Suppliers", href: "/suppliers", icon: Building2, moduleKey: "suppliers" },
      { label: "Warehouses", href: "/warehouses", icon: Warehouse, moduleKey: "warehouses" },
      { label: "Locations", href: "/locations", icon: MapPin, moduleKey: "locations" },
      { label: "Departments", href: "/departments", icon: Users, moduleKey: "departments" },
      { label: "Employees", href: "/employees", icon: UserRound, moduleKey: "employees" },
    ],
  },
  { title: null, icon: BarChart3, items: [{ label: "Reports", href: "/reports", icon: BarChart3, moduleKey: "reports" }] },
  {
    title: "Administration",
    icon: ShieldCheck,
    items: [
      { label: "Users", href: "/users", icon: UserCog, moduleKey: "users" },
      { label: "Roles", href: "/roles", icon: ShieldCheck, moduleKey: "roles" },
    ],
  },
];
