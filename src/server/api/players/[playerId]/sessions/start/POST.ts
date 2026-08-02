/**
 * POST /api/players/:playerId/sessions/start
 *
 * Starts a new pitching session for a specific player. The session begins in
 * 'calibrating' status — pitch uploads are rejected until a calibration clip
 * has been uploaded and the strike zone corners set.
 *
 * Only one non-ended session per player at a time: if an existing
 * calibrating/active session is found, it's returned instead of creating a
 * duplicate (prevents orphaned sessions from abandoned page loads).
 */
import type { Request, Response } from 'express';
import { db } from '../../../../../db/client.js';
import { pitchSessions, players } from '../../../../../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
import { getAuth } from '../../../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = sessionData.user.id;

    const rawPlayerId = req.params.playerId;
    const playerId = parseInt(Array.isArray(rawPlayerId) ? rawPlayerId[0] : rawPlayerId, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid playerId' });

    // Ownership check — the player must belong to this user
    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.userId, userId)))
      .limit(1);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Reuse an existing unfinished session rather than stacking duplicates
    const existing = await db
      .select()
      .from(pitchSessions)
      .where(and(eq(pitchSessions.playerId, playerId), ne(pitchSessions.status, 'ended')));

    if (existing.length > 0) {
      const active = existing.reduce((max, s) => (s.id > max.id ? s : max), existing[0]);
      return res.json({ session: active, resumed: true });
    }

    const label = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    await db.insert(pitchSessions).values({
      playerId,
      label,
      status: 'calibrating',
    });

    const all = await db
      .select()
      .from(pitchSessions)
      .where(eq(pitchSessions.playerId, playerId));
    const created = all.reduce((max, s) => (s.id > max.id ? s : max), all[0]);

    return res.status(201).json({ session: created, resumed: false });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to start session', message: String(error) });
  }
}
