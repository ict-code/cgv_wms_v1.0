import {
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
}

export interface NavSection {
  title: string | null;
  icon: LucideIcon;
  items: NavItem[];
  adminOnly?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  { title: null, icon: LayoutDashboard, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Inventory",
    icon: Boxes,
    items: [
      { label: "Items", href: "/items", icon: Package },
      { label: "Current Stock", href: "/inventory", icon: Boxes },
      { label: "Barcode Lookup", href: "/scan", icon: ScanLine },
    ],
  },
  {
    title: "Operations",
    icon: PackageCheck,
    items: [
      { label: "Receiving", href: "/receiving", icon: PackageCheck },
      { label: "Issuance", href: "/issuance", icon: PackageMinus },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      { label: "Returns", href: "/returns", icon: Undo2 },
      { label: "Adjustments", href: "/adjustments", icon: SlidersHorizontal },
      { label: "Stock Counting", href: "/stock-counts", icon: ClipboardList },
    ],
  },
  {
    title: "Master Data",
    icon: Database,
    items: [
      { label: "Categories", href: "/categories", icon: Tags },
      { label: "Units", href: "/units", icon: Ruler },
      { label: "Suppliers", href: "/suppliers", icon: Building2 },
      { label: "Warehouses", href: "/warehouses", icon: Warehouse },
      { label: "Locations", href: "/locations", icon: MapPin },
      { label: "Departments", href: "/departments", icon: Users },
      { label: "Employees", href: "/employees", icon: UserRound },
    ],
  },
  { title: null, icon: BarChart3, items: [{ label: "Reports", href: "/reports", icon: BarChart3 }] },
  {
    title: "Administration",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { label: "Users", href: "/users", icon: UserCog },
      { label: "Roles", href: "/roles", icon: ShieldCheck },
    ],
  },
];
