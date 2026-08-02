/**
 * POST /api/video-analyses
 *
 * Accepts a multipart/form-data upload with one or more files in the `videos`
 * field (mp4/mov, up to 100 MB each).  Optional body fields:
 *   - sessionId (int): existing pitchSessions row to tag each analysis with.
 *     If omitted, a new session is created automatically (label = today's date)
 *     and all files in this request share that new session.
 *
 * Workflow per file:
 *   1. Validate auth session
 *   2. Resolve or create pitchSessions row
 *   3. Write the file to /shared-storage/public/assets/uploads/videos/
 *      (multer already did this via diskStorage in entry.ts)
 *   4. Insert a `processing` row in pitch_video_analyses
 *   5. Respond immediately with 202 + { sessionId, results: [{ analysisId }] }
 *   6. POST to RunPod runsync in the background for each file
 *   7. Update each row with the AI result (frame_width, frame_height, etc.)
 *
 * The client polls GET /api/video-analyses/:id until status === 'done' | 'error'.
 */

import type { Request, Response } from 'express';
import { mkdirSync, appendFileSync } from 'node:fs';
import { getAuth } from '../../../lib/auth/auth.js';
import { db } from '../../db/client.js';
import { pitchVideoAnalyses, pitchSessions, players } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getSecret } from '#airo/secrets';
import { randomUUID } from 'node:crypto';

const RUNPOD_URL = 'https://api.runpod.ai/v2/3xpp90ngdzvic6/runsync';
const LOG_FILE = (process.env.UPLOAD_STORAGE_DIR || './data') + '/logs/upload-errors.log';

function persistLog(label: string, data: Record<string, unknown>) {
  const line = `[${new Date().toISOString()}] ${label} ${JSON.stringify(data)}\n`;
  try { mkdirSync((process.env.UPLOAD_STORAGE_DIR || './data') + '/logs', { recursive: true }); appendFileSync(LOG_FILE, line); } catch {}
  console.log(line.trim());
}

/** Call RunPod and update the DB row with the result. Fire-and-forget. */
async function runAnalysis(analysisId: number, absoluteVideoUrl: string, pitchId: string): Promise<void> {
  const apiKey = getSecret('RUNPOD_API_KEY');
  if (!apiKey) {
    await db
      .update(pitchVideoAnalyses)
      .set({ status: 'error', errorMessage: 'RUNPOD_API_KEY not configured.' })
      .where(eq(pitchVideoAnalyses.id, analysisId));
    return;
  }

  let runpodResult: Record<string, unknown> = {};
  let runpodError: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 90_000);

    const runpodRes = await fetch(RUNPOD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          video_url: absoluteVideoUrl,
          pitch_id: pitchId,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!runpodRes.ok) {
      const text = await runpodRes.text().catch(() => '');
      throw new Error(`RunPod returned ${runpodRes.status}: ${text.slice(0, 300)}`);
    }

    const body = await runpodRes.json() as Record<string, unknown>;
    runpodResult = (body.output as Record<string, unknown>) ?? body;

    if (runpodResult.error && typeof runpodResult.error === 'string') {
      runpodError = runpodResult.error;
    }
  } catch (err: unknown) {
    runpodError = err instanceof Error ? err.message : String(err);
    persistLog('[video-upload] runpod.call.failed', { analysisId, pitchId, error: runpodError });
  }

  if (runpodError) {
    await db
      .update(pitchVideoAnalyses)
      .set({ status: 'error', errorMessage: runpodError })
      .where(eq(pitchVideoAnalyses.id, analysisId));
  } else {
    await db
      .update(pitchVideoAnalyses)
      .set({
        status: 'done',
        impactType:    typeof runpodResult.impact_type   === 'string' ? runpodResult.impact_type   : null,
        impactFrame:   typeof runpodResult.impact_frame  === 'number' ? runpodResult.impact_frame  : null,
        ballX:         typeof runpodResult.ball_x        === 'number' ? runpodResult.ball_x        : null,
        ballY:         typeof runpodResult.ball_y        === 'number' ? runpodResult.ball_y        : null,
        combinedConf:  typeof runpodResult.combined_conf === 'number' ? runpodResult.combined_conf : null,
        frameWidth:    typeof runpodResult.frame_width   === 'number' ? runpodResult.frame_width   : null,
        frameHeight:   typeof runpodResult.frame_height  === 'number' ? runpodResult.frame_height  : null,
        flightPath:    runpodResult.flight_path !== undefined ? JSON.stringify(runpodResult.flight_path) : null,
        pathPoints:    runpodResult.path_points !== undefined ? JSON.stringify(runpodResult.path_points) : null,
        errorMessage:  null,
      })
      .where(eq(pitchVideoAnalyses.id, analysisId));
  }

  persistLog('[video-upload] background processing complete', { analysisId, error: runpodError });
}

export default async function handler(req: Request, res: Response) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = sessionData.user.id;

    // ── 2. Files from multer (.array('videos')) ───────────────────────────────
    const files = (req as Request & { files?: Express.Multer.File[] }).files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No video files received. Send a multipart/form-data request with one or more "videos" fields.' });
    }

    const allowedMime = new Set(['video/mp4', 'video/quicktime', 'video/mov']);
    for (const file of files) {
      if (!allowedMime.has(file.mimetype)) {
        return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}. Use mp4 or mov.` });
      }
    }

    persistLog('[video-upload] files received', { count: files.length, names: files.map(f => f.originalname) });

    // ── 3. Resolve or create pitchSessions row ────────────────────────────────
    let resolvedSessionId: number;

    const rawSessionId = req.body.sessionId;
    if (rawSessionId !== undefined && rawSessionId !== '') {
      const parsed = parseInt(String(rawSessionId), 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'sessionId must be an integer.' });
      }
      resolvedSessionId = parsed;
    } else {
      // Auto-create a session. We need a playerId — use the user's first player,
      // or create a placeholder player if none exists yet.
      const [firstPlayer] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.userId, userId))
        .limit(1);

      let playerId: number;
      if (firstPlayer) {
        playerId = firstPlayer.id;
      } else {
        // Create a default player so the FK is satisfied
        await db.insert(players).values({
          userId,
          name: 'Default Player',
          position: 'Pitcher',
          throws: 'R',
        });
        const [newPlayer] = await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.userId, userId))
          .limit(1);
        if (!newPlayer) {
          return res.status(500).json({ error: 'Failed to create default player.' });
        }
        playerId = newPlayer.id;
      }

      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      await db.insert(pitchSessions).values({
        playerId,
        label: today,
      });

      // Get the most recently inserted session (highest id for this player)
      const allSessions = await db
        .select({ id: pitchSessions.id })
        .from(pitchSessions)
        .where(eq(pitchSessions.playerId, playerId));

      const latestSession = allSessions.reduce((max, s) => s.id > max.id ? s : max, allSessions[0]);

      if (!latestSession) {
        return res.status(500).json({ error: 'Failed to create session.' });
      }
      resolvedSessionId = latestSession.id;
      persistLog('[video-upload] auto-created session', { sessionId: resolvedSessionId, playerId, label: today });
    }

    // ── 4. Build base URL for RunPod ──────────────────────────────────────────
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'https';
    const host  = (req.headers['x-forwarded-host']  as string | undefined) ?? req.headers.host ?? '';

    // ── 5. Insert a DB row per file and collect results ───────────────────────
    const results: { analysisId: number; filename: string }[] = [];

    for (const file of files) {
      const filename    = file.filename; // UUID.ext set by diskStorage in entry.ts
      const publicPath  = `/uploads/videos/${filename}`;
      const absoluteVideoUrl = `${proto}://${host}${publicPath}`;
      const pitchId     = randomUUID();

      await db.insert(pitchVideoAnalyses).values({
        userId,
        sessionId: resolvedSessionId,
        pitchId,
        videoUrl: absoluteVideoUrl,
        status: 'processing',
      });

      const [inserted] = await db
        .select()
        .from(pitchVideoAnalyses)
        .where(eq(pitchVideoAnalyses.pitchId, pitchId))
        .limit(1);

      if (!inserted) {
        return res.status(500).json({ error: `Failed to create analysis record for ${file.originalname}.` });
      }

      results.push({ analysisId: inserted.id, filename: file.originalname });
      persistLog('[video-upload] DB row inserted', { analysisId: inserted.id, pitchId, sessionId: resolvedSessionId });

      // Kick off RunPod in the background (don't await — respond first)
      void runAnalysis(inserted.id, absoluteVideoUrl, pitchId);
    }

    // ── 6. Respond immediately ────────────────────────────────────────────────
    res.status(202).json({ sessionId: resolvedSessionId, results });
    persistLog('[video-upload] 202 sent', { sessionId: resolvedSessionId, count: results.length });

  } catch (topLevelErr: unknown) {
    const msg   = topLevelErr instanceof Error ? topLevelErr.message : String(topLevelErr);
    const stack = topLevelErr instanceof Error ? topLevelErr.stack   : undefined;
    persistLog('[video-upload] UNHANDLED ERROR', { message: msg, stack: stack ?? 'n/a' });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', detail: msg });
    }
  }
}
