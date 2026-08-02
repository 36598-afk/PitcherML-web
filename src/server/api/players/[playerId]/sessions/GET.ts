import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitchSessions, players } from '../../../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getAuth } from '../../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const playerId = Number(req.params.playerId);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    // Verify player belongs to user
    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.userId, session.user.id)))
      .limit(1);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const sessions = await db
      .select()
      .from(pitchSessions)
      .where(eq(pitchSessions.playerId, playerId))
      .orderBy(desc(pitchSessions.sessionDate));

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions', message: String(error) });
  }
}
