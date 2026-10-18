// Express router serving available runtime locale packs.

import { Router, Request, Response } from 'express';
import { resolveLocalesDir, readLocalePacks } from '../utils/localeDirectory.js';
import snapshot from '../../src/core/shared/translationLeafSnapshot.json';
import { leavesFromSnapshot } from '../../src/core/shared/translationLeaves.js';
import { LOCALE_CODE_PATTERN } from '../../src/core/shared/localePackLimits.js';

const leaves = leavesFromSnapshot(snapshot);

export const localeRouter = Router();

localeRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  const dir = resolveLocalesDir();
  const knownKeys = new Set(leaves.keys());
  const { packs } = await readLocalePacks(dir, knownKeys, leaves);

  const summaries = packs.map(({ pack }) => {
    const total = leaves.size;
    const translated = Object.keys(pack.strings).length;
    return {
      code: pack.meta.code,
      nativeName: pack.meta.nativeName,
      englishName: pack.meta.englishName,
      dir: pack.meta.dir,
      flag: pack.meta.flag,
      translated,
      total,
    };
  });

  res.json(summaries);
});

localeRouter.get('/:code', async (req: Request, res: Response): Promise<void> => {
  const code = req.params.code;
  if (!LOCALE_CODE_PATTERN.test(code)) {
    res.status(400).json({ error: `Invalid locale code parameter: "${code}"` });
    return;
  }

  const dir = resolveLocalesDir();
  const knownKeys = new Set(leaves.keys());
  const { packs } = await readLocalePacks(dir, knownKeys, leaves);

  const found = packs.find((p) => p.pack.meta.code.toLowerCase() === code.toLowerCase());
  if (!found) {
    res.status(404).json({ error: `Locale "${code}" not found` });
    return;
  }

  res.json(found.pack);
});
