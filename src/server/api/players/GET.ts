import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { players } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getAuth } from '../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await db
      .select()
      .from(players)
      .where(eq(players.userId, session.user.id))
      .orderBy(desc(players.createdAt));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch players', message: String(error) });
  }
}
