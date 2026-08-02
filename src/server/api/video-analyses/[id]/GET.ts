/**
 * GET /api/video-analyses/:id
 * Returns a single analysis record (must belong to the authenticated user).
 */
import type { Request, Response } from 'express';
import { getAuth } from '../../../../lib/auth/auth.js';
import { db } from '../../../db/client.js';
import { pitchVideoAnalyses } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const auth = getAuth();
  const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
  if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });

  const rawId = req.params.id;
  const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const [row] = await db
    .select()
    .from(pitchVideoAnalyses)
    .where(
      and(
        eq(pitchVideoAnalyses.id, id),
        eq(pitchVideoAnalyses.userId, sessionData.user.id),
      ),
    )
    .limit(1);

  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ analysis: row });
}
