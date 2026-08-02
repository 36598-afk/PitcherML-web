/**
 * POST /api/video-analyses/upload-chunk
 *
 * Accepts a single chunk of a video file as multipart/form-data.
 * Fields:
 *   - chunk: the binary chunk (Blob/File)
 *   - uploadId: UUID identifying this upload session
 *   - chunkIndex: 0-based index of this chunk
 *   - totalChunks: total number of chunks
 *   - filename: original filename (used for extension only)
 *   - sessionId (optional): existing pitchSessions row to tag this pitch with.
 *     If omitted, a new session is auto-created (label = today's date).
 *
 * When the final chunk arrives, assembles the full file and kicks off analysis.
 * Returns:
 *   - { received: true } for intermediate chunks
 *   - { done: true, analysisId, sessionId } when all chunks assembled and DB row created
 */

import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, appendFileSync, createReadStream, createWriteStream, unlinkSync, readdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { getAuth } from '../../../../lib/auth/auth.js';
import { db } from '../../../db/client.js';
import { pitchVideoAnalyses, pitchSessions, players } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSecret } from '#airo/secrets';

// Storage location — configurable so this works on any host (see entry.ts
// for the matching multer config). Without a persistent volume attached,
// this resets on every redeploy — fine for now, worth moving to real
// object storage (Backblaze/R2) for production use.
const STORAGE_ROOT = process.env.UPLOAD_STORAGE_DIR || './data';
const CHUNK_TMP_DIR = `${STORAGE_ROOT}/uploads/chunks`;
const VIDEO_DIR = `${STORAGE_ROOT}/uploads/videos`;
const RUNPOD_URL = 'https://api.runpod.ai/v2/3xpp90ngdzvic6/runsync';
const LOG_FILE = `${STORAGE_ROOT}/logs/upload-errors.log`;

function persistLog(label: string, data: Record<string, unknown>) {
  const line = `[${new Date().toISOString()}] ${label} ${JSON.stringify(data)}\n`;
  try { mkdirSync(`${STORAGE_ROOT}/logs`, { recursive: true }); appendFileSync(LOG_FILE, line); } catch {}
  console.log(line.trim());
}

/** Resolve the session for this upload and enforce the lifecycle rules.
 * Unlike the old behaviour (auto-create a session on the fly), uploads now
 * REQUIRE an explicit, already-calibrated, active session — started from a
 * specific player's profile. This is what ties every pitch to the right
 * player and guarantees a strike zone exists to interpret it against. */
async function resolveActiveSession(userId: string, rawSessionId: unknown): Promise<number> {
  if (rawSessionId === undefined || rawSessionId === null || String(rawSessionId).trim() === '') {
    throw Object.assign(
      new Error('No session specified. Start a session from a player\'s profile before uploading pitches.'),
      { statusCode: 400 },
    );
  }

  const sessionId = parseInt(String(rawSessionId), 10);
  if (isNaN(sessionId)) {
    throw Object.assign(new Error('sessionId must be an integer.'), { statusCode: 400 });
  }

  const [row] = await db
    .select({ session: pitchSessions, player: players })
    .from(pitchSessions)
    .innerJoin(players, eq(pitchSessions.playerId, players.id))
    .where(and(eq(pitchSessions.id, sessionId), eq(players.userId, userId)))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
  }

  if (row.session.status === 'calibrating') {
    throw Object.assign(
      new Error('This session has not been calibrated yet. Set the strike zone before uploading pitches.'),
      { statusCode: 409 },
    );
  }

  if (row.session.status === 'ended') {
    throw Object.assign(
      new Error('This session has already ended. Start a new session to upload more pitches.'),
      { statusCode: 409 },
    );
  }

  return sessionId;
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = getAuth();
    const sessionData = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!sessionData?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = sessionData.user.id;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ error: 'No chunk received.' });
    }

    const uploadId = (req.body.uploadId as string | undefined)?.trim();
    const chunkIndex = parseInt(req.body.chunkIndex as string, 10);
    const totalChunks = parseInt(req.body.totalChunks as string, 10);
    const originalFilename = (req.body.filename as string | undefined) ?? 'video.mp4';
    const rawSessionId = req.body.sessionId;

    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return res.status(400).json({ error: 'Missing uploadId, chunkIndex, or totalChunks.' });
    }

    // Validate the session BEFORE writing anything to disk — no point
    // accepting chunks for a session that will be rejected at assembly time.
    let resolvedSessionId: number;
    try {
      resolvedSessionId = await resolveActiveSession(userId, rawSessionId);
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 400;
      const message = e instanceof Error ? e.message : String(e);
      persistLog('[chunk-upload] session rejected', { rawSessionId, message });
      try { unlinkSync(file.path); } catch {}
      return res.status(statusCode).json({ error: message });
    }

    persistLog('[chunk-upload] chunk received', { uploadId, chunkIndex, totalChunks, size: file.size });

    const sessionDir = join(CHUNK_TMP_DIR, uploadId);
    mkdirSync(sessionDir, { recursive: true });

    const chunkPath = join(sessionDir, `chunk-${chunkIndex}`);
    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(file.path);
      const ws = createWriteStream(chunkPath);
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
      rs.pipe(ws);
    });
    try { unlinkSync(file.path); } catch {}

    const arrivedChunks = readdirSync(sessionDir).filter(f => f.startsWith('chunk-')).length;
    if (arrivedChunks < totalChunks) {
      return res.json({ received: true, arrivedChunks, totalChunks });
    }

    mkdirSync(VIDEO_DIR, { recursive: true });
    const ext = originalFilename.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    const finalFilename = `${randomUUID()}.${ext}`;
    const finalPath = join(VIDEO_DIR, finalFilename);

    persistLog('[chunk-upload] assembling', { uploadId, totalChunks, finalFilename });

    const ws = createWriteStream(finalPath);
    await new Promise<void>((resolve, reject) => {
      ws.on('error', reject);
      ws.on('finish', resolve);

      const writeChunk = (idx: number) => {
        if (idx >= totalChunks) { ws.end(); return; }
        const cp = join(sessionDir, `chunk-${idx}`);
        const rs = createReadStream(cp);
        rs.on('error', reject);
        rs.on('end', () => writeChunk(idx + 1));
        rs.pipe(ws, { end: false });
      };
      writeChunk(0);
    });

    try {
      for (const f of readdirSync(sessionDir)) unlinkSync(join(sessionDir, f));
      rmdirSync(sessionDir);
    } catch {}

    const publicPath = `/uploads/videos/${finalFilename}`;
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
    const absoluteVideoUrl = `${proto}://${host}${publicPath}`;

    const pitchId = randomUUID();
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
      return res.status(500).json({ error: 'Failed to create analysis record.' });
    }

    res.json({ done: true, analysisId: inserted.id, sessionId: resolvedSessionId });
    persistLog('[chunk-upload] 200 sent, starting RunPod', { analysisId: inserted.id, sessionId: resolvedSessionId });

    const apiKey = getSecret('RUNPOD_API_KEY');
    if (!apiKey) {
      await db.update(pitchVideoAnalyses)
        .set({ status: 'error', errorMessage: 'RUNPOD_API_KEY not configured.' })
        .where(eq(pitchVideoAnalyses.id, inserted.id));
      return;
    }

    let runpodError: string | null = null;
    let runpodResult: Record<string, unknown> = {};

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 90_000);
      const rr = await fetch(RUNPOD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { video_url: absoluteVideoUrl, pitch_id: pitchId } }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!rr.ok) {
        const txt = await rr.text().catch(() => '');
        throw new Error(`RunPod ${rr.status}: ${txt.slice(0, 300)}`);
      }
      const body = await rr.json() as Record<string, unknown>;
      runpodResult = (body.output as Record<string, unknown>) ?? body;
      if (runpodResult.error && typeof runpodResult.error === 'string') runpodError = runpodResult.error;
    } catch (err) {
      runpodError = err instanceof Error ? err.message : String(err);
      persistLog('[chunk-upload] runpod failed', { error: runpodError });
    }

    if (runpodError) {
      await db.update(pitchVideoAnalyses)
        .set({ status: 'error', errorMessage: runpodError })
        .where(eq(pitchVideoAnalyses.id, inserted.id));
    } else {
      await db.update(pitchVideoAnalyses).set({
        status: 'done',
        impactType: typeof runpodResult.impact_type === 'string' ? runpodResult.impact_type : null,
        impactFrame: typeof runpodResult.impact_frame === 'number' ? runpodResult.impact_frame : null,
        ballX: typeof runpodResult.ball_x === 'number' ? runpodResult.ball_x : null,
        ballY: typeof runpodResult.ball_y === 'number' ? runpodResult.ball_y : null,
        combinedConf: typeof runpodResult.combined_conf === 'number' ? runpodResult.combined_conf : null,
        frameWidth: typeof runpodResult.frame_width === 'number' ? runpodResult.frame_width : null,
        frameHeight: typeof runpodResult.frame_height === 'number' ? runpodResult.frame_height : null,
        flightPath: runpodResult.flight_path !== undefined ? JSON.stringify(runpodResult.flight_path) : null,
        pathPoints: runpodResult.path_points !== undefined ? JSON.stringify(runpodResult.path_points) : null,
        errorMessage: null,
      }).where(eq(pitchVideoAnalyses.id, inserted.id));
    }

    persistLog('[chunk-upload] complete', { analysisId: inserted.id, error: runpodError });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    persistLog('[chunk-upload] UNHANDLED ERROR', { message: msg });
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
}
