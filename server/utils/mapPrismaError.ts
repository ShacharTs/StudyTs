interface MappedHttpError {
  status: number;
  message: string;
}

/**
 * Maps common Prisma known request error codes to HTTP status and clean messages.
 */
export function mapPrismaError(err: unknown): MappedHttpError | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (code === 'P2025') {
      return { status: 404, message: 'Resource not found' };
    }
    if (code === 'P2002') {
      return { status: 409, message: 'Unique constraint violation' };
    }
    if (code === 'P2003') {
      return { status: 409, message: 'Foreign key constraint violation' };
    }
  }
  return null;
}
