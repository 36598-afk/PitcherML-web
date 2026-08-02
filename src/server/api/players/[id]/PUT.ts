import type { Request, Response } from 'express';
import { db } from '../../../db/client.js';
import { players } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const playerId = Number(req.params.id);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const { name, position, team, throws: throwsHand, age, height, weight, bio } = req.body;

    await db
      .update(players)
      .set({
        name: name || undefined,
        position: position || undefined,
        team: team ?? undefined,
        throws: throwsHand || undefined,
        age: age !== undefined ? Number(age) : undefined,
        height: height ?? undefined,
        weight: weight !== undefined ? Number(weight) : undefined,
        bio: bio ?? undefined,
      })
      .where(and(eq(players.id, playerId), eq(players.userId, session.user.id)));

    const [updated] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update player', message: String(error) });
  }
}
