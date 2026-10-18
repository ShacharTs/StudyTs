import { Router, Request, Response } from 'express';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { route } from '../utils/routeHandler.js';
import {
  assertValidExtension,
  assertValidMagicBytes,
  sanitizeUploadFilename,
  safeDocumentName,
  isDocumentExtension,
  resolveUploadPath,
  InvalidUploadError,
  InvalidSlugError,
} from '../../vite-plugins/uploadValidation.js';
import { DATA_ROOT } from '../runtime/appPaths.js';

// Uploaded files live under data/assets/<courseId>/<topicId>/<generatedName>, matching the
// /assets/<courseId>/<topicId>/<name> URL shape already used by existing scene data (e.g.
// data/studyts-vision/.../scene.json's video `src`). Served back by server/index.ts's
// `express.static('/assets', ...)`. This route was dropped during the Vite-plugin→Express
// migration — the client (canvasHistoryApi.ts's uploadAsset) has been posting to it the whole
// time; only the mount was missing. Reuses vite-plugins/uploadValidation.ts's slug/extension/
// magic-byte checks rather than re-implementing them.
export const assetUploadRouter = Router();

const UPLOAD_ASSETS_ROOT = path.resolve(DATA_ROOT, 'data', 'assets');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const uploadRawParser = express.raw({
  type: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'application/pdf', 'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  limit: MAX_UPLOAD_BYTES,
});

// The client percent-encodes the name because HTTP headers are Latin-1 only.
function decodeFilenameHeader(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new InvalidUploadError('x-upload-filename is not valid percent-encoding');
  }
}

async function handleUploadAsset(req: Request, res: Response): Promise<void> {
  const courseId = req.header('x-upload-course');
  const topicId = req.header('x-upload-topic');
  const originalFilename = req.header('x-upload-filename');

  if (!courseId || !topicId || !originalFilename) {
    return void res.status(400).json({ error: 'x-upload-course, x-upload-topic, and x-upload-filename headers are required' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return void res.status(400).json({ error: 'Request body must be the raw file bytes' });
  }

  try {
    const extension = assertValidExtension(originalFilename);
    assertValidMagicBytes(req.body, extension);
    const generatedName = isDocumentExtension(extension)
      ? safeDocumentName(decodeFilenameHeader(originalFilename))
      : sanitizeUploadFilename(originalFilename);
    const destPath = resolveUploadPath(UPLOAD_ASSETS_ROOT, courseId, topicId, generatedName);

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, req.body);

    res.json({ path: `/assets/${courseId}/${topicId}/${generatedName}` });
  } catch (err) {
    if (err instanceof InvalidSlugError || err instanceof InvalidUploadError) {
      return void res.status(400).json({ error: err.message });
    }
    throw err;
  }
}

assetUploadRouter.post('/canvas-editor/upload', uploadRawParser, route(handleUploadAsset));
