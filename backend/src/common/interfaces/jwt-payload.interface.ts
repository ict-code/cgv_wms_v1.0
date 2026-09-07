import type { AppRole } from '../constants/roles.constant.js';

export interface JwtPayload {
  sub: string;
  username: string;
  role: AppRole;
  departmentId: string | null;
}
