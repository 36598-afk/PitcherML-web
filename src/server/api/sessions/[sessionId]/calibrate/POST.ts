/**
 * POST /api/sessions/:sessionId/calibrate
 *
 * Saves the strike-zone corners for a session and flips it from
 * 'calibrating' to 'active', which unlocks pitch uploads.
 *
 * Body: {
 *   zoneTop, zoneBottom, zoneLeft, zoneRight  // fractions 0-1 of the frame
 *   calibrationVideoUrl?                       // the clip it was set from
 *   frameWidth?, frameHeight?                  // that clip's dimensions
 * }
 *
 * The corners arrive as fractions rather than pixels so they stay correct
 * regardless of what size the frame was displayed at in the browser.
 */
import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitchSessions, players } from '../../../../db/schema.js';
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

    const { zoneTop, zoneBottom, zoneLeft, zoneRight,
            calibrationVideoUrl, frameWidth, frameHeight } = req.body ?? {};

    const nums = [zoneTop, zoneBottom, zoneLeft, zoneRight].map(Number);
    if (nums.some((n) => typeof n !== 'number' || isNaN(n))) {
      return res.status(400).json({ error: 'zoneTop, zoneBottom, zoneLeft and zoneRight are all required numbers.' });
    }
    const [top, bottom, left, right] = nums;
    if (top >= bottom || left >= right) {
      return res.status(400).json({ error: 'Invalid zone: top must be above bottom, left must be left of right.' });
    }
    if (nums.some((n) => n < 0 || n > 1)) {
      return res.status(400).json({ error: 'Zone values must be fractions between 0 and 1.' });
    }

    // Ownership check — session -> player -> user
    const [row] = await db
      .select({ session: pitchSessions, player: players })
      .from(pitchSessions)
      .innerJoin(players, eq(pitchSessions.playerId, players.id))
      .where(and(eq(pitchSessions.id, sessionId), eq(players.userId, userId)))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'Session not found' });
    if (row.session.status === 'ended') {
      return res.status(400).json({ error: 'This session has already ended and cannot be recalibrated.' });
    }

    await db
      .update(pitchSessions)
      .set({
        zoneTop: top,
        zoneBottom: bottom,
        zoneLeft: left,
        zoneRight: right,
        calibrationVideoUrl: calibrationVideoUrl ?? null,
        calibrationFrameWidth: frameWidth ? parseInt(String(frameWidth), 10) : null,
        calibrationFrameHeight: frameHeight ? parseInt(String(frameHeight), 10) : null,
        status: 'active',
      })
      .where(eq(pitchSessions.id, sessionId));

    const [updated] = await db
      .select()
      .from(pitchSessions)
      .where(eq(pitchSessions.id, sessionId))
      .limit(1);

    return res.json({ session: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to calibrate session', message: String(error) });
  }
}
