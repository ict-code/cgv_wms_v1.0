import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AppRole } from '../common/constants/roles.constant.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<TokenPair & { user: JwtPayload }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    // Constant-shape failure regardless of which check fails, so login timing/response
    // doesn't reveal whether a username exists or an account is merely deactivated.
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, '$2b$10$invalidsaltinvalidsaltinvalidsalu');
    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role.name as AppRole,
      departmentId: user.departmentId,
      modules: user.role.modules,
    };

    return { ...this.issueTokens(payload), user: payload };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account no longer active');
    }

    const freshPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role.name as AppRole,
      departmentId: user.departmentId,
      modules: user.role.modules,
    };
    return this.issueTokens(freshPayload);
  }

  private issueTokens(payload: JwtPayload): TokenPair {
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(this.config.get('JWT_ACCESS_TTL_SECONDS', 900)),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.config.get('JWT_REFRESH_TTL_SECONDS', 604_800)),
    });
    return { accessToken, refreshToken };
  }
}
