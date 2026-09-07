import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/**
 * Guards an inventory-changing POST against being executed twice for the
 * same logical request. Opt-in via an `Idempotency-Key` header (a client-
 * generated UUID) — requests without the header are unaffected. The key is
 * claimed with a plain unique-constraint insert, which Postgres enforces
 * atomically, so two concurrent requests carrying the same key can never
 * both reach the handler: exactly one proceeds, the other is told the
 * request is already in flight or gets the first request's stored response
 * replayed back once it completes.
 *
 * A key that gets stuck IN_PROGRESS (the process crashed mid-request) blocks
 * retries under that exact key forever — by design: the point is to prevent
 * an automatic retry from silently double-posting, not to guarantee the same
 * key stays retryable indefinitely. A client that legitimately wants to try
 * again after a stuck key should mint a new one.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const key = req.header('Idempotency-Key');
    const userId = req.user?.sub;
    if (!key || !userId) return next.handle();

    const endpoint = `${req.method} ${req.originalUrl.split('?')[0]}`;

    try {
      await this.prisma.idempotencyKey.create({ data: { key, endpoint, userId, status: 'IN_PROGRESS' } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
        if (existing?.status === 'COMPLETED') {
          const res = context.switchToHttp().getResponse<Response>();
          res.status(existing.statusCode ?? 200);
          return of(existing.responseBody);
        }
        throw new ConflictException('A request with this idempotency key is already in progress or was already completed');
      }
      throw error;
    }

    return next.handle().pipe(
      tap((body) => {
        const res = context.switchToHttp().getResponse<Response>();
        const normalized = JSON.parse(JSON.stringify(body ?? {})) as Prisma.InputJsonValue;
        void this.prisma.idempotencyKey.update({ where: { key }, data: { status: 'COMPLETED', statusCode: res.statusCode, responseBody: normalized } }).catch(() => {});
      }),
      catchError((error) => {
        void this.prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
        throw error;
      }),
    );
  }
}
