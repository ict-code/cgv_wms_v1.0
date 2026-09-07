import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { UnitsModule } from './units/units.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { ItemsModule } from './items/items.module.js';
import { RolesModule } from './roles/roles.module.js';
import { UsersModule } from './users/users.module.js';
import { ReceivingsModule } from './receivings/receivings.module.js';
import { IssuancesModule } from './issuances/issuances.module.js';
import { TransfersModule } from './transfers/transfers.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { AdjustmentsModule } from './adjustments/adjustments.module.js';
import { StockCountsModule } from './stock-counts/stock-counts.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { HealthController } from './health/health.controller.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    InventoryModule,
    DepartmentsModule,
    EmployeesModule,
    WarehousesModule,
    LocationsModule,
    CategoriesModule,
    UnitsModule,
    SuppliersModule,
    ItemsModule,
    RolesModule,
    UsersModule,
    ReceivingsModule,
    IssuancesModule,
    TransfersModule,
    ReturnsModule,
    AdjustmentsModule,
    StockCountsModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
