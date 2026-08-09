import type { Request, Response } from 'express';
import { db } from '../../../db/client.js';
import { players, pitchSessions, pitchVideoAnalyses } from '../../../db/schema.js';
import { eq, desc, count, and } from 'drizzle-orm';
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

    // Career stats — counts real pitch data from pitchVideoAnalyses (every
    // uploaded clip, regardless of session status), NOT the old unused
    // `pitches` table, which nothing in the real pipeline ever writes to.
    const [careerStats] = await db
      .select({
        totalSessions: count(pitchSessions.id),
        totalPitches: count(pitchVideoAnalyses.id),
      })
      .from(pitchSessions)
      .leftJoin(pitchVideoAnalyses, eq(pitchVideoAnalyses.sessionId, pitchSessions.id))
      .where(eq(pitchSessions.playerId, playerId));

    res.json({ player, sessions, careerStats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player', message: String(error) });
  }
}
