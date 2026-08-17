/**
 * PUT /api/video-analyses/:id
 *
 * Persists a manually-edited flight path (points removed via the report
 * page's "Edit Pitch" review flow). The new "impact" is always the LAST
 * point remaining in the edited path -- same convention path_scoring.py
 * uses (impact = last accepted point of the real flight, never
 * extrapolated) -- so ballX/ballY/impactFrame are recomputed from
 * whichever point now ends up last, not just blanked out.
 *
 * flightPath is stored normalised 0-1 against the FRAME (see the report
 * GET handler's comment), so converting a point back to ballX/ballY
 * (pixels, the columns the rest of the report pipeline derives
 * isStrike/frameX/frameY from) means multiplying by this row's own
 * frameWidth/frameHeight -- fetched from the DB, not trusted from the
 * client, so a stale or tampered frameWidth can't skew the result.
 */
import type { Request, Response } from 'express';
import { getAuth } from '../../../../lib/auth/auth.js';
import { db } from '../../../db/client.js';
import { pitchVideoAnalyses } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';

interface PathPoint { frame: number; x: number; y: number; conf?: number }

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });

    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { flightPath } = req.body as { flightPath?: PathPoint[] };
    if (!Array.isArray(flightPath)) {
      return res.status(400).json({ error: 'flightPath must be an array' });
    }
    for (const p of flightPath) {
      if (typeof p.frame !== 'number' || typeof p.x !== 'number' || typeof p.y !== 'number') {
        return res.status(400).json({ error: 'Each point needs numeric frame, x, y' });
      }
    }

    const [existing] = await db
      .select()
      .from(pitchVideoAnalyses)
      .where(and(eq(pitchVideoAnalyses.id, id), eq(pitchVideoAnalyses.userId, sessionData.user.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Keep it sorted by frame regardless of what order the client sent --
    // "last" must mean chronologically last, not last-in-array.
    const sorted = [...flightPath].sort((a, b) => a.frame - b.frame);
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    const frameWidth = existing.frameWidth;
    const frameHeight = existing.frameHeight;

    const update: Partial<typeof pitchVideoAnalyses.$inferInsert> = {
      flightPath: JSON.stringify(sorted),
    };

    if (last && frameWidth && frameHeight) {
      update.ballX = last.x * frameWidth;
      update.ballY = last.y * frameHeight;
      update.impactFrame = last.frame;
    } else if (!last) {
      // Every point was deleted -- there's no ball position left to report.
      update.ballX = null;
      update.ballY = null;
      update.impactFrame = null;
    }

    await db
      .update(pitchVideoAnalyses)
      .set(update)
      .where(and(eq(pitchVideoAnalyses.id, id), eq(pitchVideoAnalyses.userId, sessionData.user.id)));

    const [updated] = await db.select().from(pitchVideoAnalyses).where(eq(pitchVideoAnalyses.id, id)).limit(1);
    return res.json({ analysis: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update flight path', message: String(error) });
  }
}
