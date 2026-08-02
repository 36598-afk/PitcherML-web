/**
 * GET /api/players/:playerId/pitches
 * Returns all pitches across all sessions for a player.
 * Optional query params:
 *   ?sessionId=123   — filter to one session
 *   ?pitchType=Fastball — filter by type
 *   ?result=strike   — filter by result
 */

import type { Request, Response } from 'express';
import { getAuth } from '../../../../../lib/auth/auth.js';
import { db } from '../../../../db/client.js';
import { pitches, pitchSessions, players } from '../../../../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const sessionData = await getAuth().api.getSession({ headers: req.headers as unknown as Headers });
  if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });

  const rawPlayerId = req.params.playerId;
  const playerId = parseInt(Array.isArray(rawPlayerId) ? rawPlayerId[0] : rawPlayerId, 10);
  if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid playerId' });

  // Verify ownership
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.userId, sessionData.user.id)));

  if (!player) return res.status(404).json({ error: 'Player not found' });

  // Get all session IDs for this player
  const sessionRows = await db
    .select({ id: pitchSessions.id })
    .from(pitchSessions)
    .where(eq(pitchSessions.playerId, playerId));

  if (!sessionRows.length) return res.json([]);

  const sessionIds = sessionRows.map((s) => s.id);

  // Optional filters
  const { sessionId, pitchType, result } = req.query;

  const filteredIds = sessionId
    ? sessionIds.filter((id) => id === parseInt(sessionId as string, 10))
    : sessionIds;

  if (!filteredIds.length) return res.json([]);

  const conditions = [inArray(pitches.sessionId, filteredIds)];
  if (pitchType) conditions.push(eq(pitches.pitchType, pitchType as string));
  if (result) conditions.push(eq(pitches.result, result as string));

  const rows = await db
    .select()
    .from(pitches)
    .where(and(...conditions));

  return res.json(rows);
}
