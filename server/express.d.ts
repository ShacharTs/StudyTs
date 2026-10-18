import type { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      id: string;
      prisma: PrismaClient;
    }
  }
}

export {};
