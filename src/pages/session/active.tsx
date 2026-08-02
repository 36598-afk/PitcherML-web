import { useState, useRef, useCallback, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import {
  Film, CheckCircle2, AlertCircle, Loader2, Clock, ChevronRight, Zap, StopCircle,
} from 'lucide-react';

/**
 * Active session page.
 *
 * Deliberately shows NO analysis results while the session is running —
 * no impact point, no dots, no strike/ball call. Coaches see only whether
 * each clip uploaded and processed successfully. Everything analytical is
 * held back for the end-of-session report, so the read happens once, in
 * context, against the calibrated zone.
 */

interface FileProgress {
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  analysisId: number | null;
  message: string | null;
}

interface SessionInfo {
  id: number;
  label: string | null;
  status: string;
  playerId: number;
  playerName?: string;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ActiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, isPending } = useSession();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<FileProgress[]>([]);
  const [working, setWorking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Load session state — also tells us if it's already ended or still
  // needs calibration, so we can redirect rather than allow a bad upload.
  useEffect(() => {
    if (isPending || !sessionId) return;
    fetch(`/api/sessions/${sessionId}/report`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { session: SessionInfo; summary: { total: number } }) => {
        setSession(data.session);
        setUploadedCount(data.summary?.total ?? 0);
        setLoading(false);
        if (data.session.status === 'calibrating') {
          navigate(`/session/${sessionId}/calibrate`);
        } else if (data.session.status === 'ended') {
          navigate(`/session/${sessionId}/report`);
        }
      })
      .catch((e: Error) => { setLoadError(e.message); setLoading(false); });
  }, [sessionId, isPending, navigate]);

  function addFiles(incoming: File[]) {
    const accepted = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    setItems((prev) => {
      const merged = [...prev];
      for (const f of accepted) {
        if (!merged.some((m) => m.file.name === f.name && m.file.size === f.size)) {
          merged.push({ file: f, status: 'queued', progress: 0, analysisId: null, message: null });
        }
      }
      for (const f of tooBig) {
        merged.push({
          file: f, status: 'error', progress: 0, analysisId: null,
          message: `Too large (${formatBytes(f.size)}) — 100 MB max`,
        });
      }
      return merged.slice(0, MAX_FILES);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (working) return;
    addFiles(Array.from(e.dataTransfer.files));
  }, [working]);

  function update(idx: number, patch: Partial<FileProgress>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function uploadOne(file: File, idx: number): Promise<void> {
    const CHUNK_SIZE = 4 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = crypto.randomUUID();

    let analysisId: number | null = null;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
      const fd = new FormData();
      fd.append('chunk', chunk, file.name);
      fd.append('uploadId', uploadId);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('filename', file.name);
      fd.append('sessionId', String(sessionId));

      const result = await new Promise<{ done?: boolean; analysisId?: number; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/video-analyses/upload-chunk');
        xhr.withCredentials = true;
        xhr.timeout = 60_000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            update(idx, { progress: Math.round(((i + e.loaded / e.total) / totalChunks) * 100) });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error(`Chunk ${i}: bad response`)); }
          } else {
            let msg = `HTTP ${xhr.status}`;
            try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timed out'));
        xhr.send(fd);
      });

      if (result.error) throw new Error(result.error);
      if (result.done && result.analysisId !== undefined) {
        analysisId = result.analysisId;
        break;
      }
    }

    if (analysisId === null) throw new Error('Upload finished without an analysis id.');

    update(idx, { status: 'processing', progress: 100, analysisId });

    // Poll only for success/failure — we deliberately do NOT surface any of
    // the analysis values here. Those are for the end-of-session report.
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/video-analyses/${analysisId}`, { credentials: 'include' });
        if (res.ok) {
          const { analysis } = await res.json() as { analysis: { status: string; errorMessage: string | null } };
          if (analysis.status === 'done') {
            update(idx, { status: 'done' });
            setUploadedCount((c) => c + 1);
            return;
          }
          if (analysis.status === 'error') {
            update(idx, { status: 'error', message: analysis.errorMessage ?? 'Analysis failed' });
            return;
          }
        }
      } catch { /* keep polling */ }
    }
    update(idx, { status: 'error', message: 'Timed out waiting for analysis' });
  }

  async function handleUploadAll() {
    setWorking(true);
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'queued') continue;
      try {
        update(i, { status: 'uploading', progress: 0 });
        await uploadOne(items[i].file, i);
      } catch (err) {
        update(i, { status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
    setWorking(false);
  }

  async function handleEndSession() {
    if (!sessionId) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      navigate(`/session/${sessionId}/report`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setEnding(false);
    }
  }

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0d14' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d8cf8' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0d14' }}>
        <div className="text-center">
          <p className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Sign in to continue</p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Sign In</Link>
        </div>
      </div>
    );
  }

  const queued = items.filter((i) => i.status === 'queued').length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <>
      <Helmet>
        <title>Live Session — PitcherML</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-12 px-4" style={{ background: '#0a0d14' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Link to="/players" className="text-xs" style={{ color: '#6b7a99' }}>Players</Link>
            <ChevronRight size={12} style={{ color: '#3a4460' }} />
            <span className="text-xs" style={{ color: '#e8eaf0' }}>Session in progress</span>
          </div>

          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                {session?.playerName ?? 'Session'}
              </h1>
              <p className="text-sm" style={{ color: '#6b7a99' }}>
                {session?.label} · {uploadedCount} pitch{uploadedCount === 1 ? '' : 'es'} recorded
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2"
                 style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
              Zone calibrated · Active
            </div>
          </div>

          {loadError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-6"
                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#f87171' }}>{loadError}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => !working && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!working) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className="rounded-xl flex flex-col items-center justify-center gap-3 mb-5"
            style={{
              minHeight: 180,
              border: `2px dashed ${dragging ? '#1d8cf8' : '#1a2240'}`,
              background: dragging ? 'rgba(29,140,248,0.05)' : '#0f1420',
              cursor: working ? 'not-allowed' : 'pointer',
              opacity: working ? 0.5 : 1,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="video/mp4,video/quicktime,.mp4,.mov"
              className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              disabled={working}
            />
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
                 style={{ background: 'rgba(29,140,248,0.1)', border: '1.5px solid rgba(29,140,248,0.25)' }}>
              <Film size={20} style={{ color: '#1d8cf8' }} />
            </div>
            <p className="text-sm font-bold" style={{ color: '#e8eaf0' }}>Add pitch clips</p>
            <p className="text-xs" style={{ color: '#6b7a99' }}>Drop several at once · MP4 or MOV · 100 MB each</p>
          </div>

          {/* Queue */}
          {items.length > 0 && (
            <div className="flex flex-col gap-2 mb-5">
              <AnimatePresence>
                {items.map((item, i) => (
                  <motion.div
                    key={`${item.file.name}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg px-4 py-3"
                    style={{ background: '#0f1420', border: '1px solid #1a2240' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                           style={{
                             background: item.status === 'done' ? 'rgba(34,197,94,0.1)'
                               : item.status === 'error' ? 'rgba(239,68,68,0.1)'
                               : 'rgba(29,140,248,0.1)',
                           }}>
                        {item.status === 'done' && <CheckCircle2 size={14} style={{ color: '#22c55e' }} />}
                        {item.status === 'error' && <AlertCircle size={14} style={{ color: '#ef4444' }} />}
                        {(item.status === 'uploading' || item.status === 'processing') &&
                          <Loader2 size={14} className="animate-spin" style={{ color: '#1d8cf8' }} />}
                        {item.status === 'queued' && <Clock size={14} style={{ color: '#3a4460' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf0' }}>{item.file.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: item.status === 'error' ? '#f87171' : '#6b7a99' }}>
                          {item.message
                            ?? (item.status === 'queued' ? 'Ready to upload'
                              : item.status === 'uploading' ? `Uploading ${item.progress}%`
                              : item.status === 'processing' ? 'Processing…'
                              : 'Recorded')}
                        </p>
                      </div>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="rounded-full overflow-hidden mt-2" style={{ background: '#1a2240', height: 4 }}>
                        <motion.div className="h-full rounded-full" style={{ background: '#1d8cf8' }}
                                    animate={{ width: `${item.progress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {queued > 0 && !working && (
            <button
              onClick={handleUploadAll}
              className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 mb-5"
              style={{ background: '#1d8cf8', color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}
            >
              <Zap size={15} />
              Record {queued} pitch{queued === 1 ? '' : 'es'}
            </button>
          )}

          {working && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg mb-5 text-xs"
                 style={{ background: 'rgba(29,140,248,0.06)', border: '1px solid rgba(29,140,248,0.15)', color: '#6b7a99' }}>
              <Loader2 size={13} className="animate-spin" style={{ color: '#1d8cf8' }} />
              Recording pitches ({doneCount}/{items.length}) — results are held until you end the session
            </div>
          )}

          {/* End session */}
          <div className="rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#e8eaf0' }}>Finished throwing?</p>
            <p className="text-xs mb-4" style={{ color: '#6b7a99' }}>
              Ending the session locks it and generates the full report — heat maps, zone breakdown,
              and every pitch's traced flight path.
            </p>
            <button
              onClick={handleEndSession}
              disabled={working || ending}
              className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm"
              style={{
                background: working || ending ? '#1a2240' : '#ef4444',
                color: working || ending ? '#3a4460' : '#fff',
                cursor: working || ending ? 'not-allowed' : 'pointer',
              }}
            >
              {ending ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
              {ending ? 'Ending…' : 'End Session & View Report'}
            </button>
            {working && (
              <p className="text-xs mt-2" style={{ color: '#3a4460' }}>
                Wait for the current uploads to finish first.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
