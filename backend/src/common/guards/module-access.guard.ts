import { Injectable, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator.js';
import type { ModuleKey } from '../constants/modules.constant.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModules = this.reflector.getAllAndOverride<ModuleKey[]>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredModules || requiredModules.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const userModules = user?.modules ?? [];
    if (!requiredModules.some((moduleKey) => userModules.includes(moduleKey))) {
      throw new ForbiddenException('Your role does not have access to this module');
    }
    return true;
  }
}
