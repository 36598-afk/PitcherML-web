import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitches, pitchSessions, players } from '../../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '../../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const sessionId = Number(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'Invalid session ID' });

    // Verify ownership via join
    const [pitchSession] = await db
      .select({ id: pitchSessions.id, playerId: pitchSessions.playerId })
      .from(pitchSessions)
      .innerJoin(players, and(eq(players.id, pitchSessions.playerId), eq(players.userId, session.user.id)))
      .where(eq(pitchSessions.id, sessionId))
      .limit(1);
    if (!pitchSession) return res.status(404).json({ error: 'Session not found' });

    const rows = await db
      .select()
      .from(pitches)
      .where(eq(pitches.sessionId, sessionId))
      .orderBy(pitches.pitchNumber);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pitches', message: String(error) });
  }
}
