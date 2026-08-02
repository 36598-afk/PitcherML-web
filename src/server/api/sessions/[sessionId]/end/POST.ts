/**
 * POST /api/sessions/:sessionId/end
 *
 * Ends an active session. After this, pitch uploads are rejected and the
 * report becomes available. Also stamps summary counts (total/strikes/balls)
 * so the report doesn't have to recompute them every time it loads.
 *
 * Strike vs ball is decided by whether the impact point landed inside the
 * calibrated zone — same logic the report uses, computed once here.
 */
import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitchSessions, players, pitchVideoAnalyses } from '../../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '../../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = sessionData.user.id;

    const raw = req.params.sessionId;
    const sessionId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'Invalid sessionId' });

    const [row] = await db
      .select({ session: pitchSessions, player: players })
      .from(pitchSessions)
      .innerJoin(players, eq(pitchSessions.playerId, players.id))
      .where(and(eq(pitchSessions.id, sessionId), eq(players.userId, userId)))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'Session not found' });
    if (row.session.status === 'ended') {
      return res.json({ session: row.session, alreadyEnded: true });
    }

    const s = row.session;
    const pitches = await db
      .select()
      .from(pitchVideoAnalyses)
      .where(eq(pitchVideoAnalyses.sessionId, sessionId));

    // Count strikes using the calibrated zone. A pitch counts only if it
    // actually produced an impact point AND we know the frame size (needed
    // to convert absolute pixels into zone-relative position).
    let strikes = 0;
    let counted = 0;
    for (const p of pitches) {
      if (p.status !== 'done' || p.ballX === null || p.ballY === null) continue;
      if (!p.frameWidth || !p.frameHeight) continue;
      if (s.zoneTop === null || s.zoneBottom === null || s.zoneLeft === null || s.zoneRight === null) continue;

      const fx = p.ballX / p.frameWidth;   // ball position as fraction of frame
      const fy = p.ballY / p.frameHeight;
      counted++;
      if (fx >= s.zoneLeft && fx <= s.zoneRight && fy >= s.zoneTop && fy <= s.zoneBottom) {
        strikes++;
      }
    }

    await db
      .update(pitchSessions)
      .set({
        status: 'ended',
        endedAt: new Date(),
        totalPitches: pitches.length,
        strikes,
        balls: Math.max(0, counted - strikes),
      })
      .where(eq(pitchSessions.id, sessionId));

    const [updated] = await db
      .select()
      .from(pitchSessions)
      .where(eq(pitchSessions.id, sessionId))
      .limit(1);

    return res.json({ session: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to end session', message: String(error) });
  }
}
