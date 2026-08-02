import { useState, useRef, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import {
  Film, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Clock, ChevronRight, Zap,
} from 'lucide-react';
import { pitch_analysis } from 'virtual:content';

interface Analysis {
  id: number;
  pitchId: string;
  videoUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  impactType: string | null;
  impactFrame: number | null;
  combinedConf: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface FileProgress {
  file: File;
  status: 'queued' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress: number;
  analysisId: number | null;
  message: string | null;
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'selected'; files: File[] }
  | { phase: 'working'; items: FileProgress[]; sessionId: number | null }
  | { phase: 'done'; items: FileProgress[]; sessionId: number | null }
  | { phase: 'error'; message: string };

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function DropZone({ onFiles, disabled }: { onFiles: (f: File[]) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="relative rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all select-none"
      style={{
        minHeight: 260,
        border: `2px dashed ${dragging ? '#1d8cf8' : '#1a2240'}`,
        background: dragging ? 'rgba(29,140,248,0.05)' : '#0a0d14',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,.mp4,.mov"
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          if (fs.length) onFiles(fs);
          e.target.value = '';
        }}
        disabled={disabled}
      />
      <motion.div
        animate={{ scale: dragging ? 1.1 : 1 }}
        transition={{ duration: 0.15 }}
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(29,140,248,0.1)', border: '1.5px solid rgba(29,140,248,0.25)' }}
      >
        <Film size={28} style={{ color: '#1d8cf8' }} />
      </motion.div>
      <div className="text-center px-6">
        <p className="text-base font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
          {pitch_analysis.upload.dropTitle}
        </p>
        <p className="text-sm" style={{ color: '#6b7a99' }}>
          Drop several pitch clips at once — they'll be grouped into one session
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs" style={{ color: '#3a4460' }}>
        <span className="flex items-center gap-1"><CheckCircle2 size={11} /> MP4</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={11} /> MOV</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={11} /> Up to 100 MB each</span>
      </div>
    </div>
  );
}

function FileCard({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const [duration, setDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
      <video
        ref={videoRef}
        src={URL.createObjectURL(file)}
        className="hidden"
        onLoadedMetadata={() => setDuration(Math.round(videoRef.current?.duration ?? 0))}
      />
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(29,140,248,0.1)' }}>
        <Film size={18} style={{ color: '#1d8cf8' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#e8eaf0' }}>{file.name}</p>
        <p className="text-xs mt-0.5" style={{ color: '#6b7a99' }}>
          {formatBytes(file.size)}
          {duration !== null && ` · ${formatDuration(duration)}`}
        </p>
      </div>
      {!disabled && (
        <button
          onClick={onRemove}
          className="text-xs px-2.5 py-1 rounded transition-all flex-shrink-0"
          style={{ color: '#6b7a99', border: '1px solid #1a2240' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7a99'; (e.currentTarget as HTMLElement).style.borderColor = '#1a2240'; }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

function ProgressRow({ item }: { item: FileProgress }) {
  const statusColor = item.status === 'done' ? '#22c55e' : item.status === 'error' ? '#ef4444' : '#1d8cf8';
  const statusLabel =
    item.status === 'queued' ? 'Waiting…'
      : item.status === 'uploading' ? `Uploading ${item.progress}%`
        : item.status === 'analyzing' ? 'Analyzing…'
          : item.status === 'done' ? 'Complete'
            : 'Failed';

  return (
    <div className="rounded-lg px-4 py-3" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${statusColor}1a` }}>
          {item.status === 'done' && <CheckCircle2 size={14} style={{ color: statusColor }} />}
          {item.status === 'error' && <AlertCircle size={14} style={{ color: statusColor }} />}
          {(item.status === 'uploading' || item.status === 'analyzing') && <Loader2 size={14} className="animate-spin" style={{ color: statusColor }} />}
          {item.status === 'queued' && <Clock size={14} style={{ color: '#3a4460' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf0' }}>{item.file.name}</p>
          <p className="text-xs mt-0.5" style={{ color: item.status === 'error' ? '#f87171' : '#6b7a99' }}>
            {item.message ?? statusLabel}
          </p>
        </div>
        {item.status === 'done' && item.analysisId !== null && (
          <Link to={`/pitch-analysis/${item.analysisId}`} className="text-xs flex-shrink-0" style={{ color: '#1d8cf8' }}>
            View
          </Link>
        )}
      </div>
      {item.status === 'uploading' && (
        <div className="rounded-full overflow-hidden mt-2" style={{ background: '#1a2240', height: 4 }}>
          <motion.div className="h-full rounded-full" style={{ background: '#1d8cf8' }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      )}
    </div>
  );
}

function RecentAnalyses({ analyses }: { analyses: Analysis[] }) {
  if (!analyses.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
        {pitch_analysis.recent.sectionLabel}
      </p>
      <div className="flex flex-col gap-2">
        {analyses.slice(0, 5).map((a) => (
          <Link
            key={a.id}
            to={`/pitch-analysis/${a.id}`}
            className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all group"
            style={{ background: '#0f1420', border: '1px solid #1a2240' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(29,140,248,0.3)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#1a2240'}
          >
            <div
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: a.status === 'done' ? 'rgba(34,197,94,0.1)' : a.status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(29,140,248,0.1)' }}
            >
              {a.status === 'done' && <CheckCircle2 size={14} style={{ color: '#22c55e' }} />}
              {a.status === 'error' && <AlertCircle size={14} style={{ color: '#ef4444' }} />}
              {(a.status === 'pending' || a.status === 'processing') && <Loader2 size={14} className="animate-spin" style={{ color: '#1d8cf8' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf0' }}>
                {a.status === 'done'
                  ? a.impactType === 'mitt' ? 'Mitt impact detected' : a.impactType === 'bat' ? 'Bat contact detected' : 'Analysis complete'
                  : a.status === 'error' ? 'Analysis failed' : 'Processing…'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#3a4460' }}>
                {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <ChevronRight size={14} style={{ color: '#3a4460' }} className="group-hover:text-blue-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function PitchAnalysisPage() {
  const { user, isPending } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [loadedRecent, setLoadedRecent] = useState(false);

  useState(() => {
    if (isPending || loadedRecent) return;
    setLoadedRecent(true);
    fetch('/api/video-analyses', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: Analysis[]) => { if (Array.isArray(d)) setRecentAnalyses(d); })
      .catch(() => {});
  });

  function handleFiles(incoming: File[]) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name} (${formatBytes(f.size)} — over 100 MB)`);
      else accepted.push(f);
    }
    setState((prev) => {
      const existing = prev.phase === 'selected' ? prev.files : [];
      const merged = [...existing];
      for (const f of accepted) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      const capped = merged.slice(0, MAX_FILES);
      if (!capped.length) {
        return { phase: 'error', message: rejected.length ? `No usable files. ${rejected.join(', ')}` : 'No files selected.' };
      }
      return { phase: 'selected', files: capped };
    });
  }

  function removeFile(idx: number) {
    setState((prev) => {
      if (prev.phase !== 'selected') return prev;
      const next = prev.files.filter((_, i) => i !== idx);
      return next.length ? { phase: 'selected', files: next } : { phase: 'idle' };
    });
  }

  async function uploadOneFile(
    file: File,
    sessionId: number | null,
    onProgress: (pct: number) => void,
  ): Promise<{ analysisId: number; sessionId: number | null }> {
    const CHUNK_SIZE = 4 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = crypto.randomUUID();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const fd = new FormData();
      fd.append('chunk', chunk, file.name);
      fd.append('uploadId', uploadId);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('filename', file.name);
      if (sessionId !== null) fd.append('sessionId', String(sessionId));

      const result = await new Promise<{ received?: boolean; done?: boolean; analysisId?: number; sessionId?: number; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/video-analyses/upload-chunk');
        xhr.withCredentials = true;
        xhr.timeout = 60_000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round(((i + e.loaded / e.total) / totalChunks) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error(`Chunk ${i}: bad JSON (HTTP ${xhr.status})`)); }
          } else {
            let msg = `Chunk ${i}: HTTP ${xhr.status}`;
            try { msg += ` — ${(JSON.parse(xhr.responseText) as { error?: string }).error ?? ''}`; } catch {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error(`Chunk ${i}: network error`));
        xhr.onabort = () => reject(new Error(`Chunk ${i}: aborted`));
        xhr.ontimeout = () => reject(new Error(`Chunk ${i}: timed out after 60 s`));
        xhr.send(fd);
      });

      if (result.error) throw new Error(result.error);
      if (result.done && result.analysisId !== undefined) {
        onProgress(100);
        return { analysisId: result.analysisId, sessionId: result.sessionId ?? sessionId };
      }
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
    throw new Error('Upload finished but no analysisId was returned.');
  }

  async function pollAnalysis(analysisId: number): Promise<Analysis> {
    const MAX_ATTEMPTS = 60;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`/api/video-analyses/${analysisId}`, { credentials: 'include' });
        if (res.ok) {
          const { analysis } = await res.json() as { analysis: Analysis };
          if (analysis.status === 'done' || analysis.status === 'error') return analysis;
        }
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Analysis timed out.');
  }

  async function handleSubmit() {
    if (state.phase !== 'selected') return;
    const files = state.files;
    const items: FileProgress[] = files.map((file) => ({ file, status: 'queued', progress: 0, analysisId: null, message: null }));
    let sharedSessionId: number | null = null;
    setState({ phase: 'working', items, sessionId: null });

    const update = (idx: number, patch: Partial<FileProgress>) => {
      setState((prev) => {
        if (prev.phase !== 'working' && prev.phase !== 'done') return prev;
        const next = prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
        return { ...prev, items: next };
      });
    };

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        update(idx, { status: 'uploading', progress: 0 });
        const { analysisId, sessionId } = await uploadOneFile(file, sharedSessionId, (pct) => update(idx, { progress: pct }));

        if (sharedSessionId === null && sessionId !== null && sessionId !== undefined) {
          sharedSessionId = sessionId;
          setState((prev) => (prev.phase === 'working' || prev.phase === 'done') ? { ...prev, sessionId: sharedSessionId } : prev);
        }

        update(idx, { status: 'analyzing', analysisId });
        const analysis = await pollAnalysis(analysisId);

        if (analysis.status === 'error') {
          update(idx, { status: 'error', message: analysis.errorMessage ?? 'Analysis failed.' });
        } else {
          update(idx, { status: 'done' });
          setRecentAnalyses((prev) => [analysis, ...prev]);
        }
      } catch (err) {
        update(idx, { status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }

    setState((prev) => prev.phase === 'working' ? { phase: 'done', items: prev.items, sessionId: prev.sessionId } : prev);
  }

  const isProcessing = state.phase === 'working';

  if (isPending) {
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
          <p className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Sign in to analyze pitches</p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Sign In</Link>
        </div>
      </div>
    );
  }

  const doneCount = (state.phase === 'working' || state.phase === 'done') ? state.items.filter((i) => i.status === 'done').length : 0;
  const errorCount = (state.phase === 'working' || state.phase === 'done') ? state.items.filter((i) => i.status === 'error').length : 0;

  return (
    <>
      <Helmet>
        <title>Pitch Video Analysis — PitcherML</title>
        <meta name="description" content="Upload pitch videos and get AI-powered ball tracking, impact detection, and flight path analysis." />
        <link rel="canonical" href="https://pitcherml.com/pitch-analysis" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-12 px-4" style={{ background: '#0a0d14' }}>
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Link to="/dashboard" className="text-xs" style={{ color: '#6b7a99' }}>Dashboard</Link>
              <ChevronRight size={12} style={{ color: '#3a4460' }} />
              <span className="text-xs" style={{ color: '#e8eaf0' }}>Pitch Analysis</span>
            </div>
            <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
              {pitch_analysis.hero.title}
            </h1>
            <p className="text-sm" style={{ color: '#6b7a99' }}>
              {pitch_analysis.hero.subtitle}
            </p>
          </div>

          <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1a2240' }}>
              <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Upload Videos</p>
              {state.phase === 'selected' && (
                <span className="text-xs" style={{ color: '#6b7a99' }}>
                  {state.files.length} file{state.files.length === 1 ? '' : 's'} selected
                </span>
              )}
            </div>

            <div className="p-6 flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {state.phase === 'idle' && (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <DropZone onFiles={handleFiles} disabled={false} />
                  </motion.div>
                )}

                {state.phase === 'selected' && (
                  <motion.div key="selected" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                    {state.files.map((f, i) => (
                      <FileCard key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => removeFile(i)} disabled={false} />
                    ))}
                    <button
                      onClick={() => setState({ phase: 'idle' })}
                      className="self-start text-xs px-3 py-1.5 rounded"
                      style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                    >
                      Clear all
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ background: '#1d8cf8', color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', boxShadow: '0 0 24px rgba(29,140,248,0.25)' }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#3a9ef9'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#1d8cf8'}
                    >
                      <Zap size={15} />
                      Analyze {state.files.length} pitch{state.files.length === 1 ? '' : 'es'}
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}

                {(state.phase === 'working' || state.phase === 'done') && (
                  <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                        {state.phase === 'done' ? 'Batch complete' : 'Processing batch…'}
                      </p>
                      <p className="text-xs" style={{ color: '#6b7a99' }}>
                        {doneCount} done{errorCount > 0 ? ` · ${errorCount} failed` : ''} / {state.items.length}
                      </p>
                    </div>
                    {state.items.map((item, i) => (
                      <ProgressRow key={`${item.file.name}-${i}`} item={item} />
                    ))}
                    {state.phase === 'working' && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs mt-1" style={{ background: 'rgba(29,140,248,0.06)', border: '1px solid rgba(29,140,248,0.15)', color: '#6b7a99' }}>
                        <Clock size={12} style={{ color: '#1d8cf8' }} />
                        Each pitch takes roughly 30–60 seconds — keep this tab open
                      </div>
                    )}
                    {state.phase === 'done' && (
                      <div className="flex gap-3 mt-2">
                        {state.sessionId !== null && (
                          <button
                            onClick={() => navigate(`/strike-zone?sessionId=${state.sessionId}`)}
                            className="flex-1 py-2.5 rounded font-semibold text-sm"
                            style={{ background: '#1d8cf8', color: '#fff' }}
                          >
                            View session results
                          </button>
                        )}
                        <button
                          onClick={() => setState({ phase: 'idle' })}
                          className="flex-1 py-2.5 rounded font-semibold text-sm"
                          style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                        >
                          Upload more
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {state.phase === 'error' && (
                  <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                      <p className="text-sm" style={{ color: '#f87171' }}>{state.message}</p>
                    </div>
                    <button
                      onClick={() => setState({ phase: 'idle' })}
                      className="w-full py-2.5 rounded font-semibold text-sm"
                      style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                    >
                      Try again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {state.phase !== 'working' && state.phase !== 'done' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {pitch_analysis.features.map((f) => {
                const icons = [Film, Zap, CheckCircle2];
                const Icon = icons[pitch_analysis.features.indexOf(f) % icons.length];
                return (
                  <div key={f.id} className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                    <Icon size={16} className="mb-2" style={{ color: '#1d8cf8' }} />
                    <p className="text-xs font-bold mb-0.5" style={{ color: '#e8eaf0' }}>{f.label}</p>
                    <p className="text-xs" style={{ color: '#6b7a99' }}>{f.desc}</p>
                  </div>
                );
              })}
            </motion.div>
          )}

          {!isProcessing && <RecentAnalyses analyses={recentAnalyses} />}
        </div>
      </main>
    </>
  );
}
