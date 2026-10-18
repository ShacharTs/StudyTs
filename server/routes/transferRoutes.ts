import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { readArchive } from '../transfer/archiveReader.js';
import { buildArchive } from '../transfer/archiveWriter.js';
import { planImport, ConflictPolicy } from '../transfer/importPlanner.js';
import { applyImportPlan } from '../transfer/importApplier.js';
import { ArchiveError, detectKind } from '../transfer/archiveManifest.js';
import { TRANSFER_LIMITS } from '../transfer/transferLimits.js';
import { DATA_ROOT } from '../runtime/appPaths.js';

function extractZipUint8Array(rawBody: unknown): Uint8Array {
  if (rawBody instanceof Uint8Array) return rawBody;
  if (Buffer.isBuffer(rawBody)) {
    return new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
  }
  return new Uint8Array(rawBody as ArrayLike<number>);
}

function parseHeaderPolicy(headerValue: unknown): ConflictPolicy | Record<string, ConflictPolicy> | null {
  if (typeof headerValue !== 'string') return null;
  if (headerValue === 'skip' || headerValue === 'replace' || headerValue === 'duplicate') {
    return headerValue;
  }
  try {
    const parsed = JSON.parse(headerValue);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, ConflictPolicy>;
  } catch (err) {
    return null;
  }
  return null;
}

function parsePolicyInput(req: Request): ConflictPolicy | Record<string, ConflictPolicy> {
  const queryPolicy = req.query.policy;
  if (queryPolicy === 'skip' || queryPolicy === 'replace' || queryPolicy === 'duplicate') {
    return queryPolicy;
  }
  const fromHeader = parseHeaderPolicy(req.headers['x-conflict-policy']);
  if (fromHeader) return fromHeader;
  return 'skip';
}

export function createTransferRouter(dataDir?: string): Router {
  const router = Router();
  const targetDataDir = dataDir ?? path.join(DATA_ROOT, 'data');

  const rawParser = express.raw({
    type: [
      'application/zip',
      'application/x-zip-compressed',
      'multipart/x-zip',
      'application/octet-stream',
    ],
    limit: TRANSFER_LIMITS.maxCompressedBytes,
  });

  router.post('/preview', rawParser, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma: PrismaClient = req.prisma;
      const bytes = extractZipUint8Array(req.body);
      const archive = readArchive(bytes);

      const existing = await prisma.course.findMany({ select: { id: true } });
      const existingIds = new Set(existing.map((c) => c.id));
      const plan = planImport(archive, existingIds, 'skip');

      res.json({
        kind: plan.kind,
        formatVersion: archive.manifest.formatVersion,
        courses: plan.courses.map((c) => ({
          sourceId: c.sourceId,
          title: c.course.meta.title ?? c.sourceId,
          topicCount: c.topicCount,
          conflict: c.conflict,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/import', rawParser, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma: PrismaClient = req.prisma;
      const bytes = extractZipUint8Array(req.body);
      const archive = readArchive(bytes);

      const policy = parsePolicyInput(req);
      const existing = await prisma.course.findMany({ select: { id: true } });
      const existingIds = new Set(existing.map((c) => c.id));
      const plan = planImport(archive, existingIds, policy);

      const result = await applyImportPlan(prisma, plan, targetDataDir);
      res.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma: PrismaClient = req.prisma;
      const isAll = req.query.all === '1' || req.query.all === 'true';
      const courseQuery = typeof req.query.courses === 'string' ? req.query.courses.split(',') : [];

      let courses;
      if (isAll) {
        courses = await prisma.course.findMany({
          include: { weeks: { include: { topics: true } } },
        });
      } else if (courseQuery.length > 0) {
        courses = await prisma.course.findMany({
          where: { id: { in: courseQuery } },
          include: { weeks: { include: { topics: true } } },
        });
      } else {
        res.status(400).json({ error: "Missing required query '?all=1' or '?courses=id1,id2'" });
        return;
      }

      if (courses.length === 0) {
        res.status(404).json({ error: 'No matching courses found to export' });
        return;
      }

      const kind = detectKind(courses.map((c) => c.id), isAll);
      const zipBytes = buildArchive(courses, kind, '1.0.0');

      const filename =
        courses.length === 1 ? `${courses[0].id}.zip` : isAll ? 'studyts-backup.zip' : 'courses-bundle.zip';

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(zipBytes));
    } catch (err) {
      next(err);
    }
  });

  // Error handler middleware
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ArchiveError) {
      res.status(err.status).json({ code: err.code, error: err.message });
      return;
    }
    next(err);
  });

  return router;
}
