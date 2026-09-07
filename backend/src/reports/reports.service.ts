import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { toPdf } from '../common/utils/pdf.util.js';
import type { TransactionsReportQueryDto } from './dto/transactions-report-query.dto.js';
import type { ReportExportQueryDto } from './dto/report-export-query.dto.js';

export type ReportKey =
  | 'current-inventory'
  | 'low-stock'
  | 'out-of-stock'
  | 'expiring'
  | 'transactions'
  | 'issuances-by-department'
  | 'issuances-by-employee'
  | 'stock-count-variance';

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async currentInventory(warehouseId?: string, locationId?: string, categoryId?: string, itemId?: string) {
    return this.prisma.inventoryBalance.findMany({
      where: {
        ...(warehouseId && { warehouseId }),
        ...(locationId && { locationId }),
        ...(itemId && { itemId }),
        ...(categoryId && { item: { categoryId } }),
      },
      include: { item: { include: { category: true, unit: true } }, warehouse: true, location: true },
      orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }],
    });
  }

  /** Aggregated in application code: item catalogs at this system's scale don't warrant raw SQL aggregation. */
  async lowStock(warehouseId?: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { ...(warehouseId && { warehouseId }) },
      include: { item: true, warehouse: true },
    });
    const byItem = new Map<string, { item: (typeof balances)[number]['item']; warehouseId: string; totalAvailable: Prisma.Decimal }>();
    for (const balance of balances) {
      const key = `${balance.itemId}:${balance.warehouseId}`;
      const existing = byItem.get(key);
      if (existing) {
        existing.totalAvailable = existing.totalAvailable.plus(balance.availableQuantity);
      } else {
        byItem.set(key, { item: balance.item, warehouseId: balance.warehouseId, totalAvailable: balance.availableQuantity });
      }
    }
    return [...byItem.values()]
      .filter((entry) => entry.totalAvailable.lte(entry.item.reorderLevel) && entry.item.reorderLevel.gt(0))
      .sort((a, b) => a.totalAvailable.comparedTo(b.totalAvailable));
  }

  async outOfStock(warehouseId?: string) {
    const lowStock = await this.lowStock(warehouseId);
    return lowStock.filter((entry) => entry.totalAvailable.lte(0));
  }

  /**
   * Best-effort: inventory_balances is not batch-tracked, so this surfaces items
   * whose most recent RECEIVE carried an expiry within the window, not an exact
   * remaining-quantity-per-batch figure.
   */
  async expiring(days: number, warehouseId?: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'RECEIVE',
        expiryDate: { not: null, lte: cutoff },
        ...(warehouseId && { warehouseId }),
      },
      include: { item: true, warehouse: true, location: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  private transactionsWhere(
    query: Pick<TransactionsReportQueryDto, 'transactionType' | 'warehouseId' | 'itemId' | 'performedBy' | 'dateFrom' | 'dateTo'>,
  ): Prisma.InventoryTransactionWhereInput {
    return {
      ...(query.transactionType && { transactionType: query.transactionType as never }),
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.itemId && { itemId: query.itemId }),
      ...(query.performedBy && { performedBy: query.performedBy }),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
    };
  }

  async transactions(query: TransactionsReportQueryDto) {
    const where = this.transactionsWhere(query);
    const [data, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { item: true, warehouse: true, location: true, performedByUser: { select: { fullname: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async transactionsXlsx(query: TransactionsReportQueryDto): Promise<Buffer> {
    const where = this.transactionsWhere(query);
    const rows = await this.prisma.inventoryTransaction.findMany({
      where,
      include: { item: true, warehouse: true, location: true, performedByUser: { select: { fullname: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return toXlsx(
      'Transaction Ledger',
      ['Txn No.', 'Type', 'Item', 'Warehouse', 'Location', 'Quantity', 'Performed By', 'Date'],
      rows.map((r) => [
        r.transactionNo,
        r.transactionType,
        r.item.name,
        r.warehouse.name,
        r.location.name,
        r.quantity.toString(),
        r.performedByUser.fullname,
        r.createdAt.toISOString(),
      ]),
    );
  }

  async issuancesByDepartment(dateFrom?: string, dateTo?: string, warehouseId?: string) {
    const where: Prisma.IssuanceWhereInput = {
      status: 'ISSUED',
      ...(warehouseId && { warehouseId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };
    const issuances = await this.prisma.issuance.findMany({
      where,
      include: { requestingDepartment: true, items: true },
    });

    const byDepartment = new Map<string, { department: (typeof issuances)[number]['requestingDepartment']; issuanceCount: number; totalValue: Prisma.Decimal }>();
    for (const issuance of issuances) {
      const key = issuance.requestingDepartmentId;
      const totalValue = issuance.items.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.quantityIssued ?? 0).times(item.unitCost)),
        new Prisma.Decimal(0),
      );
      const existing = byDepartment.get(key);
      if (existing) {
        existing.issuanceCount += 1;
        existing.totalValue = existing.totalValue.plus(totalValue);
      } else {
        byDepartment.set(key, { department: issuance.requestingDepartment, issuanceCount: 1, totalValue });
      }
    }
    return [...byDepartment.values()];
  }

  async issuancesByEmployee(dateFrom?: string, dateTo?: string, warehouseId?: string) {
    const where: Prisma.IssuanceWhereInput = {
      status: 'ISSUED',
      employeeId: { not: null },
      ...(warehouseId && { warehouseId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };
    const issuances = await this.prisma.issuance.findMany({
      where,
      include: { employee: true, items: true },
    });

    const byEmployee = new Map<string, { employee: (typeof issuances)[number]['employee']; issuanceCount: number; totalValue: Prisma.Decimal }>();
    for (const issuance of issuances) {
      if (!issuance.employeeId) continue;
      const totalValue = issuance.items.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.quantityIssued ?? 0).times(item.unitCost)),
        new Prisma.Decimal(0),
      );
      const existing = byEmployee.get(issuance.employeeId);
      if (existing) {
        existing.issuanceCount += 1;
        existing.totalValue = existing.totalValue.plus(totalValue);
      } else {
        byEmployee.set(issuance.employeeId, { employee: issuance.employee, issuanceCount: 1, totalValue });
      }
    }
    return [...byEmployee.values()];
  }

  async dashboard(warehouseId?: string) {
    const balanceWhere = { ...(warehouseId && { warehouseId }) };
    const [totalItems, quantitySum, lowStock, outOfStock, expiring, recentlyReceived, recentlyIssued, recentAdjustments, recentTransfers, pendingReceiving, pendingIssuance, pendingTransferApproval, pendingAdjustmentApproval, pendingStockCounts] =
      await Promise.all([
        this.prisma.item.count({ where: { status: 'ACTIVE' } }),
        this.prisma.inventoryBalance.aggregate({ where: balanceWhere, _sum: { quantity: true } }),
        this.lowStock(warehouseId),
        this.outOfStock(warehouseId),
        this.expiring(30, warehouseId),
        this.prisma.inventoryTransaction.findMany({
          where: { transactionType: 'RECEIVE', ...(warehouseId && { warehouseId }) },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { item: true },
        }),
        this.prisma.inventoryTransaction.findMany({
          where: { transactionType: 'ISSUE', ...(warehouseId && { warehouseId }) },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { item: true },
        }),
        this.prisma.inventoryTransaction.findMany({
          where: { transactionType: { in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] }, ...(warehouseId && { warehouseId }) },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { item: true },
        }),
        this.prisma.transfer.findMany({
          where: { ...(warehouseId && { warehouseId }) },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { fromLocation: true, toLocation: true },
        }),
        this.prisma.receiving.count({ where: { status: 'PENDING', ...(warehouseId && { warehouseId }) } }),
        this.prisma.issuance.count({ where: { status: 'PENDING_APPROVAL', ...(warehouseId && { warehouseId }) } }),
        this.prisma.transfer.count({ where: { status: 'PENDING_APPROVAL', ...(warehouseId && { warehouseId }) } }),
        this.prisma.adjustment.count({ where: { status: 'PENDING_APPROVAL', ...(warehouseId && { warehouseId }) } }),
        this.prisma.stockCount.count({ where: { status: { in: ['SUBMITTED', 'REVIEWED'] }, ...(warehouseId && { warehouseId }) } }),
      ]);

    return {
      inventory: {
        totalItems,
        totalQuantity: quantitySum._sum.quantity ?? new Prisma.Decimal(0),
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        expiringCount: expiring.length,
        recentlyReceived,
        recentlyIssued,
        recentAdjustments,
      },
      operations: {
        pendingReceiving,
        pendingIssuance,
        pendingApprovals: pendingIssuance + pendingTransferApproval + pendingAdjustmentApproval,
        pendingStockCounts,
        recentTransfers,
      },
      alerts: {
        lowStock,
        outOfStock,
        expiring,
      },
    };
  }

  async stockCountVariance(stockCountId?: string) {
    return this.prisma.stockCountItem.findMany({
      where: {
        variance: { not: 0 },
        ...(stockCountId && { stockCountId }),
      },
      include: { item: true, stockCount: { include: { warehouse: true, location: true } } },
      orderBy: { variance: 'asc' },
    });
  }

  /** Builds the {title, headers, rows} table shape shared by CSV/Excel/PDF export for every report in the catalog. */
  private async getReportTable(key: ReportKey, query: ReportExportQueryDto): Promise<ReportTable> {
    switch (key) {
      case 'current-inventory': {
        const rows = await this.currentInventory(query.warehouseId, query.locationId, query.categoryId, query.itemId);
        return {
          title: 'Current Inventory',
          headers: ['Item Code', 'Item Name', 'Category', 'Warehouse', 'Location', 'Quantity', 'Reserved', 'Available'],
          rows: rows.map((r) => [
            r.item.itemCode,
            r.item.name,
            r.item.category.name,
            r.warehouse.name,
            r.location.name,
            r.quantity.toString(),
            r.reservedQuantity.toString(),
            r.availableQuantity.toString(),
          ]),
        };
      }
      case 'low-stock':
      case 'out-of-stock': {
        const rows = key === 'low-stock' ? await this.lowStock(query.warehouseId) : await this.outOfStock(query.warehouseId);
        return {
          title: key === 'low-stock' ? 'Low Stock' : 'Out of Stock',
          headers: ['Item Code', 'Item Name', 'Reorder Level', 'Available'],
          rows: rows.map((r) => [r.item.itemCode, r.item.name, r.item.reorderLevel.toString(), r.totalAvailable.toString()]),
        };
      }
      case 'expiring': {
        const rows = await this.expiring(query.days ?? 30, query.warehouseId);
        return {
          title: 'Expiring Inventory',
          headers: ['Item Code', 'Item Name', 'Warehouse', 'Location', 'Expiry Date', 'Quantity'],
          rows: rows.map((r) => [r.item.itemCode, r.item.name, r.warehouse.name, r.location.name, r.expiryDate?.toISOString().slice(0, 10) ?? '', r.quantity.toString()]),
        };
      }
      case 'transactions': {
        const where = this.transactionsWhere(query);
        const rows = await this.prisma.inventoryTransaction.findMany({
          where,
          include: { item: true, warehouse: true, location: true, performedByUser: { select: { fullname: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          title: 'Transaction Ledger',
          headers: ['Txn No.', 'Type', 'Item', 'Warehouse', 'Location', 'Quantity', 'Performed By', 'Date'],
          rows: rows.map((r) => [
            r.transactionNo,
            r.transactionType,
            r.item.name,
            r.warehouse.name,
            r.location.name,
            r.quantity.toString(),
            r.performedByUser.fullname,
            r.createdAt.toISOString(),
          ]),
        };
      }
      case 'issuances-by-department': {
        const rows = await this.issuancesByDepartment(query.dateFrom, query.dateTo, query.warehouseId);
        return {
          title: 'Issuances by Department',
          headers: ['Department', 'Issuance Count', 'Total Value'],
          rows: rows.map((r) => [r.department?.name ?? '-', r.issuanceCount, r.totalValue.toString()]),
        };
      }
      case 'issuances-by-employee': {
        const rows = await this.issuancesByEmployee(query.dateFrom, query.dateTo, query.warehouseId);
        return {
          title: 'Issuances by Employee',
          headers: ['Employee', 'Issuance Count', 'Total Value'],
          rows: rows.map((r) => [r.employee?.fullname ?? '-', r.issuanceCount, r.totalValue.toString()]),
        };
      }
      case 'stock-count-variance': {
        const rows = await this.stockCountVariance(query.stockCountId);
        return {
          title: 'Stock Count Variance',
          headers: ['Count No.', 'Item', 'System Qty', 'Physical Qty', 'Variance'],
          rows: rows.map((r) => [r.stockCount.countNo, r.item.name, r.systemQuantity.toString(), r.physicalQuantity.toString(), r.variance.toString()]),
        };
      }
      default:
        throw new BadRequestException(`Unknown report: ${key}`);
    }
  }

  async exportReport(key: ReportKey, format: ReportFormat, query: ReportExportQueryDto): Promise<{ buffer: Buffer | string; contentType: string; filename: string }> {
    const table = await this.getReportTable(key, query);
    if (format === 'csv') {
      return { buffer: toCsv(table.headers, table.rows), contentType: 'text/csv; charset=utf-8', filename: `${key}.csv` };
    }
    if (format === 'xlsx') {
      return {
        buffer: await toXlsx(table.title, table.headers, table.rows),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${key}.xlsx`,
      };
    }
    return { buffer: await toPdf(table.title, table.headers, table.rows), contentType: 'application/pdf', filename: `${key}.pdf` };
  }
}
