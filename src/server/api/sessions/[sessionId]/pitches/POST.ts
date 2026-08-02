import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitches, pitchSessions, players } from '../../../../db/schema.js';
import { eq, and, count, avg, max, sql } from 'drizzle-orm';
import { getAuth } from '../../../../../lib/auth/auth.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const sessionId = Number(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'Invalid session ID' });

    // Verify ownership
    const [pitchSession] = await db
      .select({ id: pitchSessions.id, totalPitches: pitchSessions.totalPitches })
      .from(pitchSessions)
      .innerJoin(players, and(eq(players.id, pitchSessions.playerId), eq(players.userId, session.user.id)))
      .where(eq(pitchSessions.id, sessionId))
      .limit(1);
    if (!pitchSession) return res.status(404).json({ error: 'Session not found' });

    const {
      pitchType,
      velocity,
      spinRate,
      locationX,
      locationY,
      result,
      count: pitchCount,
    } = req.body;

    const pitchNumber = (pitchSession.totalPitches ?? 0) + 1;

    // Insert pitch
    const insertResult = await db.insert(pitches).values({
      sessionId,
      pitchType: pitchType || 'Fastball',
      velocity: velocity ? Number(velocity) : null,
      spinRate: spinRate ? Number(spinRate) : null,
      locationX: locationX !== undefined ? Number(locationX) : null,
      locationY: locationY !== undefined ? Number(locationY) : null,
      result: result || 'strike',
      count: pitchCount || '0-0',
      pitchNumber,
    });

    // Recompute session aggregates
    const [agg] = await db
      .select({
        total: count(pitches.id),
        strikes: sql<number>`SUM(CASE WHEN ${pitches.result} IN ('strike','foul','swinging_strike') THEN 1 ELSE 0 END)`,
        balls: sql<number>`SUM(CASE WHEN ${pitches.result} = 'ball' THEN 1 ELSE 0 END)`,
        avgVelo: avg(pitches.velocity),
        maxVelo: max(pitches.velocity),
      })
      .from(pitches)
      .where(eq(pitches.sessionId, sessionId));

    await db
      .update(pitchSessions)
      .set({
        totalPitches: Number(agg.total),
        strikes: Number(agg.strikes ?? 0),
        balls: Number(agg.balls ?? 0),
        avgVelocity: agg.avgVelo ? Number(agg.avgVelo) : null,
        maxVelocity: agg.maxVelo ? Number(agg.maxVelo) : null,
      })
      .where(eq(pitchSessions.id, sessionId));

    const newPitchId = Number(insertResult[0].insertId);
    const [newPitch] = await db.select().from(pitches).where(eq(pitches.id, newPitchId)).limit(1);

    res.status(201).json({ pitch: newPitch, pitchNumber });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log pitch', message: String(error) });
  }
}
