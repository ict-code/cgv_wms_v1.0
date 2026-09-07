import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService, type ReportFormat, type ReportKey } from './reports.service.js';
import { TransactionsReportQueryDto } from './dto/transactions-report-query.dto.js';
import { ReportExportQueryDto } from './dto/report-export-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';

const REPORT_KEYS: ReportKey[] = [
  'current-inventory',
  'low-stock',
  'out-of-stock',
  'expiring',
  'transactions',
  'issuances-by-department',
  'issuances-by-employee',
  'stock-count-variance',
];
const REPORT_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

const CAN_VIEW_REPORTS = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.INVENTORY_CONTROLLER, AppRole.AUDITOR];

@ApiBearerAuth()
@ApiTags('reports')
@Roles(...CAN_VIEW_REPORTS)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Roles(AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF, AppRole.INVENTORY_CONTROLLER, AppRole.AUDITOR)
  @Get('dashboard')
  dashboard(@Query('warehouseId') warehouseId?: string) {
    return this.service.dashboard(warehouseId);
  }

  @Get('inventory/current')
  currentInventory(
    @Query('warehouseId') warehouseId?: string,
    @Query('locationId') locationId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.service.currentInventory(warehouseId, locationId, categoryId, itemId);
  }

  @Get('inventory/low-stock')
  lowStock(@Query('warehouseId') warehouseId?: string) {
    return this.service.lowStock(warehouseId);
  }

  @Get('inventory/out-of-stock')
  outOfStock(@Query('warehouseId') warehouseId?: string) {
    return this.service.outOfStock(warehouseId);
  }

  @Get('inventory/expiring')
  expiring(@Query('days') days?: string, @Query('warehouseId') warehouseId?: string) {
    return this.service.expiring(days ? Number(days) : 30, warehouseId);
  }

  @Get('transactions')
  transactions(@Query() query: TransactionsReportQueryDto) {
    return this.service.transactions(query);
  }

  @Get('transactions/export.xlsx')
  async transactionsXlsx(@Query() query: TransactionsReportQueryDto, @Res() res: Response) {
    const buffer = await this.service.transactionsXlsx(query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="transaction-ledger.xlsx"');
    res.send(buffer);
  }

  @Get('issuances-by-department')
  issuancesByDepartment(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.issuancesByDepartment(dateFrom, dateTo, warehouseId);
  }

  @Get('issuances-by-employee')
  issuancesByEmployee(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.issuancesByEmployee(dateFrom, dateTo, warehouseId);
  }

  @Get('stock-counts/variance')
  stockCountVariance(@Query('stockCountId') stockCountId?: string) {
    return this.service.stockCountVariance(stockCountId);
  }

  /** Single export endpoint for the whole report catalog: /reports/:key/export/:format?filters... */
  @Get(':key/export/:format')
  async exportReport(@Param('key') key: string, @Param('format') format: string, @Query() query: ReportExportQueryDto, @Res() res: Response) {
    if (!REPORT_KEYS.includes(key as ReportKey)) throw new BadRequestException(`Unknown report: ${key}`);
    if (!REPORT_FORMATS.includes(format as ReportFormat)) throw new BadRequestException(`Unsupported format: ${format}`);

    const { buffer, contentType, filename } = await this.service.exportReport(key as ReportKey, format as ReportFormat, query);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
