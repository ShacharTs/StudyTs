import { Router, type Request, type Response } from 'express';
import { createRequire } from 'module';
import { route } from '../utils/routeHandler.js';
import { checkStatus, writeState, clearLastResult } from '../update/updateModule.js';

const require = createRequire(import.meta.url);
const { parseVersion } = require('../../scripts/update/versionCompare.cjs');

export const updateStatusRouter = Router();

updateStatusRouter.get('/update/status', route(async (_req: Request, res: Response) => {
  const result = await checkStatus(false);
  res.status(200).json(result);
}));

const FORCED_CHECK_MIN_INTERVAL_MS = 30_000;
let lastForcedCheckAt = 0;

updateStatusRouter.post('/update/check', route(async (_req: Request, res: Response) => {
  const now = Date.now();
  if (now - lastForcedCheckAt < FORCED_CHECK_MIN_INTERVAL_MS) {
    const cached = await checkStatus(false);
    return void res.status(200).json({ ...cached, throttled: true });
  }
  lastForcedCheckAt = now;
  res.status(200).json(await checkStatus(true));
}));

updateStatusRouter.post('/update/schedule', route(async (req: Request, res: Response) => {
  const { version } = req.body as { version?: unknown };
  if (typeof version !== 'string' || !parseVersion(version)) {
    return void res.status(400).json({ error: 'Valid semver version string required' });
  }

  const currentStatus = await checkStatus(false);
  const latest = currentStatus.latest;

  if (!latest || (latest.version !== version && latest.tag !== version)) {
    return void res.status(409).json({ error: 'Requested version does not match available release' });
  }

  writeState({ pendingVersion: version });
  res.status(200).json({ ok: true });
}));

updateStatusRouter.post('/update/skip', route(async (req: Request, res: Response) => {
  const { version } = req.body as { version?: unknown };
  if (typeof version !== 'string' || !parseVersion(version)) {
    return void res.status(400).json({ error: 'Valid semver version string required' });
  }

  writeState({ skippedVersion: version });
  res.status(200).json({ ok: true });
}));

updateStatusRouter.post('/update/clear-result', route(async (_req: Request, res: Response) => {
  clearLastResult();
  res.status(200).json({ ok: true });
}));

// Only start.cjs relaunches on exit code 75; a bare `tsx` run would just die.
updateStatusRouter.post('/update/restart', route(async (_req: Request, res: Response) => {
  if (process.env.STUDYTS_SUPERVISED !== '1') {
    return void res.status(409).json({ error: 'Restart needs run.bat or npm start' });
  }
  res.status(200).json({ ok: true });
  // Delay so the response leaves before the socket closes.
  setTimeout(() => process.exit(75), 300);
}));
