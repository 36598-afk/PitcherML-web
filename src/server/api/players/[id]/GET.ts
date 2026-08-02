import type { Request, Response } from 'express';
import { db } from '../../../db/client.js';
import { players, pitchSessions, pitches } from '../../../db/schema.js';
import { eq, desc, avg, max, count, and } from 'drizzle-orm';
import { getAuth } from '../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const playerId = Number(req.params.id);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.userId, session.user.id)))
      .limit(1);

    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Fetch sessions with aggregated stats
    const sessions = await db
      .select()
      .from(pitchSessions)
      .where(eq(pitchSessions.playerId, playerId))
      .orderBy(desc(pitchSessions.sessionDate));

    // Aggregate career stats
    const [careerStats] = await db
      .select({
        totalSessions: count(pitchSessions.id),
        totalPitches: count(pitches.id),
        avgVelocity: avg(pitches.velocity),
        maxVelocity: max(pitches.velocity),
      })
      .from(pitchSessions)
      .leftJoin(pitches, eq(pitches.sessionId, pitchSessions.id))
      .where(eq(pitchSessions.playerId, playerId));

    res.json({ player, sessions, careerStats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player', message: String(error) });
  }
}
