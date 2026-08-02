import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { players } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuth } from '../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, position, team, throws: throwsHand, age, height, weight, bio } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await db.insert(players).values({
      userId: session.user.id,
      name,
      position: position || 'Pitcher',
      team: team || null,
      throws: throwsHand || 'R',
      age: age ? Number(age) : null,
      height: height || null,
      weight: weight ? Number(weight) : null,
      bio: bio || null,
    });

    const insertId = Number(result[0].insertId);
    const newPlayer = await db.select().from(players).where(eq(players.id, insertId)).limit(1);
    res.status(201).json(newPlayer[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create player', message: String(error) });
  }
}
