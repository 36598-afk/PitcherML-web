/**
 * GET /api/video-analyses
 * Returns all analyses belonging to the authenticated user, newest first.
 */
import type { Request, Response } from 'express';
import { getAuth } from '../../../lib/auth/auth.js';
import { db } from '../../db/client.js';
import { pitchVideoAnalyses } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const auth = getAuth();
  const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
  if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db
    .select()
    .from(pitchVideoAnalyses)
    .where(eq(pitchVideoAnalyses.userId, sessionData.user.id))
    .orderBy(desc(pitchVideoAnalyses.createdAt));

  return res.json(rows);
}
