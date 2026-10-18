/**
 * Central API Router Barrel: mounts all domain route modules.
 */

import { Router } from 'express';
import { registryRouter } from './registry.js';
import { contentRouter } from './content.js';
import { coursesRouter } from './courses.js';
import { scenesRouter } from './scenes.js';
import { chatRouter } from './chat.js';
import { aiChatProxyRouter } from './aiChatProxy.js';
import { aiModelsRouter } from './aiModels.js';
import { aiKeysRouter } from './aiKeys.js';
import { updateStatusRouter } from './updateStatus.js';
import { pdfIngestionRouter } from './pdfIngestion.js';
import { aiAttachmentsRouter } from './aiAttachments.js';
import { mcpRouter } from './mcp.js';
import { canvasStoreRouter } from './canvasStore.js';
import { visualSpecsRouter } from './visualSpecs.js';
import { clientErrorsRouter } from './clientErrors.js';
import { logsRouter } from './logs.js';
import { localeRouter } from './localeRoutes.js';
import { createTransferRouter } from './transferRoutes.js';
import { contentChangeStreamHandler } from '../utils/contentChangeStream.js';

export const apiRouter = Router();

apiRouter.get('/content-changes', contentChangeStreamHandler);
apiRouter.use('/locales', localeRouter);
apiRouter.use('/transfer', createTransferRouter());
apiRouter.use(clientErrorsRouter);
apiRouter.use(logsRouter);
apiRouter.use(registryRouter);
apiRouter.use(contentRouter);
apiRouter.use(coursesRouter);
apiRouter.use(scenesRouter);
apiRouter.use(canvasStoreRouter);
apiRouter.use(visualSpecsRouter);
apiRouter.use(chatRouter);
apiRouter.use(aiChatProxyRouter);
apiRouter.use(aiModelsRouter);
apiRouter.use(aiKeysRouter);
apiRouter.use(updateStatusRouter);
apiRouter.use(pdfIngestionRouter);
apiRouter.use(aiAttachmentsRouter);
apiRouter.use(mcpRouter);
