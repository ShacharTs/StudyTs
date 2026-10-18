/**
 * GET/PUT /api/chat-session
 * Persists the AI chat's display + provider message history across page reloads.
 * Single-user app — one fixed session row, no auth/multi-session concept.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { route } from '../utils/routeHandler.js';

export const chatRouter = Router();

const SESSION_ID = 'default';

// Postgres text/JSONB columns reject the null character outright (error 22P05) — a garbled
// AI response (seen once during a JSON-escaping failure) can contain one, so strip it before
// every write rather than let one bad character crash the whole request.
const NULL_CHAR = String.fromCharCode(0);

function stripNullBytes<T>(value: T): T {
  if (typeof value === 'string') return (value.split(NULL_CHAR).join('') as unknown) as T;
  if (Array.isArray(value)) return value.map(stripNullBytes) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripNullBytes(v);
    return out as T;
  }
  return value;
}

chatRouter.get('/chat-session', route(async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.prisma;

  const session = await prisma.chatSession.findUnique({ where: { id: SESSION_ID } });
  if (!session) {
    return void res.json({ displayMessages: [], conversationHistory: [] });
  }
  res.json({
    displayMessages: session.displayMessages,
    conversationHistory: session.conversationHistory,
  });
}));

chatRouter.put('/chat-session', route(async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.prisma;
  const { displayMessages, conversationHistory } = req.body;

  if (!Array.isArray(displayMessages) || !Array.isArray(conversationHistory)) {
    return void res.status(400).json({ error: 'displayMessages and conversationHistory must be arrays' });
  }

  await prisma.chatSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      displayMessages: stripNullBytes(displayMessages),
      conversationHistory: stripNullBytes(conversationHistory),
    },
    update: {
      displayMessages: stripNullBytes(displayMessages),
      conversationHistory: stripNullBytes(conversationHistory),
    },
  });
  res.json({ success: true });
}));

chatRouter.delete('/chat-session', route(async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.prisma;
  await prisma.chatSession.deleteMany({ where: { id: SESSION_ID } });
  res.json({ success: true });
}));
