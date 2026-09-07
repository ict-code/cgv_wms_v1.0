import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Runs a delete operation and turns a foreign-key violation (the record is
 * still referenced elsewhere — inventory transactions, other master data,
 * etc.) into a clean 409 instead of a raw Prisma error, since hard-deleting
 * referenced master data would break the audit trail.
 */
export async function deleteOrConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2003' || error.code === 'P2014')) {
      throw new ConflictException('Cannot delete: this record is referenced by other data.');
    }
    throw error;
  }
}

/**
 * Runs a create/update operation and turns a unique-constraint violation
 * (duplicate code, username, email, etc.) into a clean 409 with the
 * offending field named, instead of a raw 500 from an uncaught Prisma error.
 */
export async function saveOrConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target;
      const field = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
      throw new ConflictException(`A record with this ${field} already exists.`);
    }
    throw error;
  }
}
