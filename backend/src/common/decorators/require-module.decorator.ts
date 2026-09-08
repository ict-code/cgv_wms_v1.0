import { SetMetadata } from '@nestjs/common';
import type { ModuleKey } from '../constants/modules.constant.js';

export const REQUIRE_MODULE_KEY = 'requireModule';
export const RequireModule = (...modules: ModuleKey[]) => SetMetadata(REQUIRE_MODULE_KEY, modules);
