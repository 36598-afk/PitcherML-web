/**
 * GET /api/sessions/:sessionId/report
 *
 * Full post-session report. Converts every pitch's raw pixel coordinates
 * into ZONE-RELATIVE coordinates, where:
 *   (0,0) = top-left corner of the strike zone
 *   (1,1) = bottom-right corner of the strike zone
 * so anything outside 0-1 landed outside the zone — negative means past the
 * left/top edge, >1 means past the right/bottom edge. This is what lets the
 * frontend draw the zone centered with impacts positioned around it like a
 * coordinate plane.
 *
 * Also buckets pitches into a 5x5 grid: the inner 3x3 is the strike zone
 * proper (the classic 9-box), and the surrounding ring captures misses
 * instead of discarding them.
 */
import type { Request, Response } from 'express';
import { db } from '../../../../db/client.js';
import { pitchSessions, players, pitchVideoAnalyses } from '../../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '../../../../../lib/auth/auth.js';

interface PathPoint { frame: number; x: number; y: number; conf?: number }

/** Converts a frame-fraction coordinate into zone-relative space. */
function toZoneSpace(
  fx: number, fy: number,
  zoneLeft: number, zoneRight: number, zoneTop: number, zoneBottom: number,
): { zx: number; zy: number } {
  const w = zoneRight - zoneLeft;
  const h = zoneBottom - zoneTop;
  return {
    zx: w !== 0 ? (fx - zoneLeft) / w : 0,
    zy: h !== 0 ? (fy - zoneTop) / h : 0,
  };
}

/** Buckets a zone-relative point into the 5x5 grid (row, col), where
 *  rows/cols 1-3 are inside the zone and 0 / 4 are the outside ring. */
function bucket(zx: number, zy: number): { row: number; col: number } {
  const idx = (v: number) => {
    if (v < 0) return 0;              // past the near edge
    if (v >= 1) return 4;             // past the far edge
    return 1 + Math.min(2, Math.floor(v * 3));  // inside: thirds -> 1,2,3
  };
  return { row: idx(zy), col: idx(zx) };
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = sessionData.user.id;

    const raw = req.params.sessionId;
    const sessionId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'Invalid sessionId' });

    const [row] = await db
      .select({ session: pitchSessions, player: players })
      .from(pitchSessions)
      .innerJoin(players, eq(pitchSessions.playerId, players.id))
      .where(and(eq(pitchSessions.id, sessionId), eq(players.userId, userId)))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'Session not found' });

    const s = row.session;
    const rawPitches = await db
      .select()
      .from(pitchVideoAnalyses)
      .where(eq(pitchVideoAnalyses.sessionId, sessionId));

    rawPitches.sort((a, b) => a.id - b.id);

    const hasZone =
      s.zoneTop !== null && s.zoneBottom !== null &&
      s.zoneLeft !== null && s.zoneRight !== null;

    // 5x5 grid counts, [row][col]
    const grid: number[][] = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);

    const pitches = rawPitches.map((p, i) => {
      const base = {
        id: p.id,
        pitchNumber: i + 1,
        status: p.status,
        impactType: p.impactType,
        impactFrame: p.impactFrame,
        combinedConf: p.combinedConf,
        videoUrl: p.videoUrl,
        errorMessage: p.errorMessage,
        frameWidth: p.frameWidth,
        frameHeight: p.frameHeight,
        createdAt: p.createdAt,
      };

      if (p.status !== 'done' || p.ballX === null || p.ballY === null ||
          !p.frameWidth || !p.frameHeight || !hasZone) {
        return { ...base, frameX: null, frameY: null, zoneX: null, zoneY: null, isStrike: null, flightPath: [] as PathPoint[] };
      }

      const fx = p.ballX / p.frameWidth;
      const fy = p.ballY / p.frameHeight;
      const { zx, zy } = toZoneSpace(fx, fy, s.zoneLeft!, s.zoneRight!, s.zoneTop!, s.zoneBottom!);
      const isStrike = zx >= 0 && zx <= 1 && zy >= 0 && zy <= 1;

      const b = bucket(zx, zy);
      grid[b.row][b.col]++;

      // Flight path is stored normalised 0-1 against the FRAME by
      // infer_pitch71 — kept as-is (frame-relative) here, since the report
      // now plots everything against the full frame, not a zoomed zone crop.
      let flightPath: PathPoint[] = [];
      try {
        const parsed = p.flightPath ? JSON.parse(p.flightPath) : [];
        if (Array.isArray(parsed)) {
          flightPath = parsed.map((pt: { frame?: number; x: number; y: number; conf?: number }) => ({
            frame: pt.frame ?? 0,
            x: pt.x,
            y: pt.y,
            conf: pt.conf,
          } as PathPoint));
        }
      } catch { /* leave empty on malformed JSON */ }

      return { ...base, frameX: fx, frameY: fy, zoneX: zx, zoneY: zy, isStrike, flightPath };
    });

    const scored = pitches.filter((p) => p.isStrike !== null);
    const strikes = scored.filter((p) => p.isStrike).length;

    return res.json({
      session: {
        id: s.id,
        label: s.label,
        status: s.status,
        playerId: s.playerId,
        playerName: row.player.name,
        zoneTop: s.zoneTop,
        zoneBottom: s.zoneBottom,
        zoneLeft: s.zoneLeft,
        zoneRight: s.zoneRight,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
      },
      summary: {
        total: pitches.length,
        analyzed: scored.length,
        strikes,
        balls: scored.length - strikes,
        strikePct: scored.length ? (strikes / scored.length) * 100 : 0,
        failed: pitches.filter((p) => p.status === 'error').length,
      },
      grid,
      pitches,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to build report', message: String(error) });
  }
}
