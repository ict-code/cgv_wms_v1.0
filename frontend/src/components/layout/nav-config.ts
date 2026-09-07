import type { IconComponent } from "@/lib/types";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import InventoryRounded from "@mui/icons-material/InventoryRounded";
import QrCodeScannerRounded from "@mui/icons-material/QrCodeScannerRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import OutboxRounded from "@mui/icons-material/OutboxRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import StorageRounded from "@mui/icons-material/StorageRounded";
import SellRounded from "@mui/icons-material/SellRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import ApartmentRounded from "@mui/icons-material/ApartmentRounded";
import WarehouseRounded from "@mui/icons-material/WarehouseRounded";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ManageAccountsRounded from "@mui/icons-material/ManageAccountsRounded";

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
}

export interface NavSection {
  title: string | null;
  icon: IconComponent;
  items: NavItem[];
  adminOnly?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  { title: null, icon: DashboardRounded, items: [{ label: "Dashboard", href: "/dashboard", icon: DashboardRounded }] },
  {
    title: "Inventory",
    icon: Inventory2Rounded,
    items: [
      { label: "Items", href: "/items", icon: InventoryRounded },
      { label: "Current Stock", href: "/inventory", icon: Inventory2Rounded },
      { label: "Barcode Lookup", href: "/scan", icon: QrCodeScannerRounded },
    ],
  },
  {
    title: "Operations",
    icon: AssignmentTurnedInRounded,
    items: [
      { label: "Receiving", href: "/receiving", icon: AssignmentTurnedInRounded },
      { label: "Issuance", href: "/issuance", icon: OutboxRounded },
      { label: "Transfers", href: "/transfers", icon: SwapHorizRounded },
      { label: "Returns", href: "/returns", icon: UndoRounded },
      { label: "Adjustments", href: "/adjustments", icon: TuneRounded },
      { label: "Stock Counting", href: "/stock-counts", icon: FactCheckRounded },
    ],
  },
  {
    title: "Master Data",
    icon: StorageRounded,
    items: [
      { label: "Categories", href: "/categories", icon: SellRounded },
      { label: "Units", href: "/units", icon: StraightenRounded },
      { label: "Suppliers", href: "/suppliers", icon: ApartmentRounded },
      { label: "Warehouses", href: "/warehouses", icon: WarehouseRounded },
      { label: "Locations", href: "/locations", icon: PlaceRounded },
      { label: "Departments", href: "/departments", icon: GroupsRounded },
      { label: "Employees", href: "/employees", icon: PersonRounded },
    ],
  },
  { title: null, icon: BarChartRounded, items: [{ label: "Reports", href: "/reports", icon: BarChartRounded }] },
  {
    title: "Administration",
    icon: AdminPanelSettingsRounded,
    adminOnly: true,
    items: [
      { label: "Users", href: "/users", icon: ManageAccountsRounded },
      { label: "Roles", href: "/roles", icon: AdminPanelSettingsRounded },
    ],
  },
];
