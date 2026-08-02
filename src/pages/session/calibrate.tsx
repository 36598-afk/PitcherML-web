import { useState, useRef, useCallback, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/lib/auth/auth-client';
import { Loader2, AlertCircle, Film, RotateCcw, Check, ChevronRight } from 'lucide-react';

/**
 * Session calibration: upload one clip, scrub to a good frame, then click
 * three corners to define the strike zone.
 *
 * Same 3-click axis-lock approach as the desktop app:
 *   click 1 (top-left)     locks the TOP and LEFT edges
 *   click 2 (top-right)    only its X is used -> RIGHT edge
 *   click 3 (bottom-left)  only its Y is used -> BOTTOM edge
 * This guarantees a proper axis-aligned rectangle even if the clicks are
 * slightly off, which free-form corner dragging does not.
 */

type Corner = { x: number; y: number };

export default function SessionCalibratePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, isPending } = useSession();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frameCaptured, setFrameCaptured] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [clicks, setClicks] = useState<Corner[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  function handleFile(f: File) {
    setError(null);
    setClicks([]);
    setFrameCaptured(false);
    setVideoUrl(URL.createObjectURL(f));
  }

  /** Draw the current video frame onto the canvas and freeze it for clicking. */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('Could not read the video dimensions. Try a different clip.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    setDims({ w, h });
    setFrameCaptured(true);
    setClicks([]);
  }, []);

  /** Records a click as a FRACTION of the frame, not pixels, so it stays
   *  correct regardless of how big the canvas is displayed on screen. */
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (clicks.length >= 3) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setClicks((prev) => [...prev, { x, y }]);
  }

  // Derive the rectangle from the three clicks using axis-lock rules
  const zone = (() => {
    if (clicks.length < 3) return null;
    const [tl, tr, bl] = clicks;
    const top = tl.y;
    const left = tl.x;
    const right = tr.x;
    const bottom = bl.y;
    if (right <= left || bottom <= top) return null;
    return { top, bottom, left, right };
  })();

  async function handleSave() {
    if (!zone || !sessionId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/calibrate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneTop: zone.top,
          zoneBottom: zone.bottom,
          zoneLeft: zone.left,
          zoneRight: zone.right,
          frameWidth: dims?.w,
          frameHeight: dims?.h,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      navigate(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

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
          <p className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            Sign in to calibrate a session
          </p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const cornerLabels = ['top-left', 'top-right', 'bottom-left'];

  return (
    <>
      <Helmet>
        <title>Calibrate Strike Zone — PitcherML</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-12 px-4" style={{ background: '#0a0d14' }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Link to="/players" className="text-xs" style={{ color: '#6b7a99' }}>Players</Link>
            <ChevronRight size={12} style={{ color: '#3a4460' }} />
            <span className="text-xs" style={{ color: '#e8eaf0' }}>Calibrate Session</span>
          </div>

          <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            Set the Strike Zone
          </h1>
          <p className="text-sm mb-8" style={{ color: '#6b7a99' }}>
            Upload one clip from this session's camera setup, freeze a clear frame, then click the
            three corners of the strike zone. Every pitch in this session is measured against it.
          </p>

          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-6"
                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
            </div>
          )}

          {/* Step 1 — pick a clip */}
          {!videoUrl && (
            <div
              onClick={() => inputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer"
              style={{ minHeight: 240, border: '2px dashed #1a2240', background: '#0f1420' }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                   style={{ background: 'rgba(29,140,248,0.1)', border: '1.5px solid rgba(29,140,248,0.25)' }}>
                <Film size={24} style={{ color: '#1d8cf8' }} />
              </div>
              <div className="text-center px-6">
                <p className="text-base font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                  Upload a calibration clip
                </p>
                <p className="text-sm" style={{ color: '#6b7a99' }}>
                  Any clip filmed from the same camera position you'll use all session
                </p>
              </div>
            </div>
          )}

          {/* Step 2 — scrub and freeze a frame */}
          {videoUrl && !frameCaptured && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid #1a2240' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                  Scrub to a frame where the plate and catcher are clearly visible
                </p>
              </div>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full"
                style={{ maxHeight: 480, background: '#000' }}
              />
              <div className="p-4 flex gap-3">
                <button
                  onClick={captureFrame}
                  className="px-5 py-2.5 rounded font-semibold text-sm"
                  style={{ background: '#1d8cf8', color: '#fff' }}
                >
                  Freeze this frame
                </button>
                <button
                  onClick={() => { setVideoUrl(null); }}
                  className="px-5 py-2.5 rounded font-semibold text-sm"
                  style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                >
                  Choose a different clip
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — click the corners */}
          <div style={{ display: frameCaptured ? 'block' : 'none' }}>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1a2240' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                  {clicks.length < 3
                    ? `Click the ${cornerLabels[clicks.length]} corner of the strike zone`
                    : 'Strike zone set'}
                </p>
                <span className="text-xs" style={{ color: '#6b7a99' }}>{clicks.length} / 3</span>
              </div>

              <div className="relative" style={{ lineHeight: 0 }}>
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="w-full"
                  style={{ cursor: clicks.length < 3 ? 'crosshair' : 'default', maxHeight: 560, objectFit: 'contain' }}
                />
                {/* Overlay markers + resulting rectangle, positioned by percentage
                    so they track the canvas at any display size */}
                <div className="absolute inset-0 pointer-events-none">
                  {clicks.map((c, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        left: `${c.x * 100}%`, top: `${c.y * 100}%`,
                        width: 10, height: 10, marginLeft: -5, marginTop: -5,
                        background: '#1d8cf8', border: '2px solid #fff',
                      }}
                    />
                  ))}
                  {zone && (
                    <div
                      className="absolute"
                      style={{
                        left: `${zone.left * 100}%`,
                        top: `${zone.top * 100}%`,
                        width: `${(zone.right - zone.left) * 100}%`,
                        height: `${(zone.bottom - zone.top) * 100}%`,
                        border: '2px solid #22c55e',
                        background: 'rgba(34,197,94,0.12)',
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="p-4 flex gap-3 flex-wrap">
                <button
                  onClick={() => setClicks([])}
                  className="flex items-center gap-2 px-4 py-2.5 rounded font-semibold text-sm"
                  style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                >
                  <RotateCcw size={13} /> Reset corners
                </button>
                <button
                  onClick={() => { setFrameCaptured(false); setClicks([]); }}
                  className="px-4 py-2.5 rounded font-semibold text-sm"
                  style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                >
                  Pick a different frame
                </button>
                <button
                  onClick={handleSave}
                  disabled={!zone || saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm ml-auto"
                  style={{
                    background: zone && !saving ? '#22c55e' : '#1a2240',
                    color: zone && !saving ? '#fff' : '#3a4460',
                    cursor: zone && !saving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Saving…' : 'Save zone & start uploading'}
                </button>
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: '#3a4460' }}>
              Only the first click's Y sets the top edge, the second click's X sets the right edge, and the
              third click's Y sets the bottom edge — so the zone stays a clean rectangle even if your clicks aren't perfect.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
