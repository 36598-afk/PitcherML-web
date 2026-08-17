import { useEffect, useState, useMemo, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import { Loader2, AlertCircle, ChevronRight, Target, Grid3x3, Flame, Play, LayoutGrid, Pencil, Check, Trash2, X, Loader } from 'lucide-react';

/**
 * End-of-session report.
 *
 * Everything is plotted in FULL-FRAME coordinates — (0,0) is the top-left of
 * the camera's video frame, (1,1) is the bottom-right — exactly matching what
 * the video itself shows. The strike zone is drawn as a box positioned and
 * sized correctly WITHIN that frame (using the calibrated zoneTop/Bottom/
 * Left/Right fractions directly), rather than the plot being zoomed into the
 * zone. This keeps the full pitch flight path in view instead of cropping
 * out most of it.
 */

interface PathPoint { frame: number; x: number; y: number; conf?: number }

interface ZoneBounds { top: number; bottom: number; left: number; right: number }

interface Pitch {
  id: number;
  pitchNumber: number;
  status: string;
  impactType: string | null;
  impactFrame: number | null;
  combinedConf: number | null;
  videoUrl: string;
  errorMessage: string | null;
  frameWidth: number | null;
  fps: number | null;
  frameHeight: number | null;
  frameX: number | null;   // ball position as a fraction of the FULL frame
  frameY: number | null;
  zoneX: number | null;    // same position, zone-relative (used for strike/ball only)
  zoneY: number | null;
  isStrike: boolean | null;
  flightPath: PathPoint[];
}

interface Report {
  session: { id: number; label: string | null; playerName: string; status: string;
             zoneTop: number | null; zoneBottom: number | null;
             zoneLeft: number | null; zoneRight: number | null };
  summary: { total: number; analyzed: number; strikes: number; balls: number; strikePct: number; failed: number };
  grid: number[][];
  pitches: Pitch[];
}

const PAD = 0.06; // small padding around the full frame so edge points aren't clipped

function px(x: number) { return ((x + PAD) / (1 + PAD * 2)) * 100; }
function py(y: number) { return ((y + PAD) / (1 + PAD * 2)) * 100; }

function isBat(p: Pitch) { return p.impactType?.toLowerCase() === 'bat'; }
function dotColor(p: Pitch): string {
  if (isBat(p)) return '#f97316'; // orange — contact, distinct from strike/ball
  return p.isStrike ? '#22c55e' : '#ef4444';
}

// ─── Strike zone, drawn in real position within the full frame ────────────────

function ZoneBox({ zone }: { zone: ZoneBounds }) {
  const l = px(zone.left), r = px(zone.right), t = py(zone.top), b = py(zone.bottom);
  return (
    <>
      <rect x={l} y={t} width={r - l} height={b - t}
            fill="rgba(29,140,248,0.06)" stroke="#1d8cf8" strokeWidth={0.5} />
      {[1, 2].map((i) => (
        <g key={i}>
          <line x1={px(zone.left + (zone.right - zone.left) * i / 3)} y1={t}
                x2={px(zone.left + (zone.right - zone.left) * i / 3)} y2={b}
                stroke="#1d8cf8" strokeWidth={0.2} opacity={0.5} />
          <line x1={l} y1={py(zone.top + (zone.bottom - zone.top) * i / 3)}
                x2={r} y2={py(zone.top + (zone.bottom - zone.top) * i / 3)}
                stroke="#1d8cf8" strokeWidth={0.2} opacity={0.5} />
        </g>
      ))}
    </>
  );
}

// ─── Session-wide location plot ────────────────────────────────────────────────

function LocationPlot({ pitches, zone, highlight }: { pitches: Pitch[]; zone: ZoneBounds; highlight?: Pitch | null }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', background: '#0a0d14', borderRadius: 8 }}>
      <ZoneBox zone={zone} />
      {pitches.map((p) => {
        if (p.frameX === null || p.frameY === null) return null;
        const isHi = highlight && highlight.id === p.id;
        return (
          <circle
            key={p.id}
            cx={px(p.frameX)} cy={py(p.frameY)}
            r={isHi ? 2.4 : 1.5}
            fill={dotColor(p)}
            stroke={isHi ? '#fff' : 'rgba(0,0,0,0.4)'}
            strokeWidth={isHi ? 0.7 : 0.3}
            opacity={highlight && !isHi ? 0.25 : 0.9}
          />
        );
      })}
    </svg>
  );
}

// ─── Smooth density heatmap (gaussian-blurred, canvas-rendered) ───────────────

function DensityHeatmap({ pitches, zone }: { pitches: Pitch[]; zone: ZoneBounds }) {
  const points = pitches
    .filter((p) => p.frameX !== null && p.frameY !== null)
    .map((p) => ({ x: p.frameX as number, y: p.frameY as number }));

  const dataUrl = useMemo(() => {
    const RES = 64; // internal render resolution, upscaled by CSS for smoothness
    const canvas = document.createElement('canvas');
    canvas.width = RES; canvas.height = RES;
    const ctx = canvas.getContext('2d');
    if (!ctx || points.length === 0) return null;

    const density = new Float32Array(RES * RES);
    const sigma = RES * 0.09; // kernel spread, tuned for a broadcast-style soft blur

    for (const pt of points) {
      const cx = pt.x * RES, cy = pt.y * RES;
      const r = Math.ceil(sigma * 3);
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.round(cy + dy);
        if (yy < 0 || yy >= RES) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.round(cx + dx);
          if (xx < 0 || xx >= RES) continue;
          const d2 = dx * dx + dy * dy;
          density[yy * RES + xx] += Math.exp(-d2 / (2 * sigma * sigma));
        }
      }
    }

    let max = 0;
    for (let i = 0; i < density.length; i++) max = Math.max(max, density[i]);
    if (max === 0) return null;

    const img = ctx.createImageData(RES, RES);
    for (let i = 0; i < density.length; i++) {
      const t = density[i] / max;
      const [r, g, b, a] = heatRGBA(t);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('|')]);

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: '#0a0d14' }}>
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{
            imageRendering: 'auto',
            filter: 'blur(3px)',
            opacity: 0.85,
            left: `${(PAD / (1 + PAD * 2)) * 100}%`,
            top: `${(PAD / (1 + PAD * 2)) * 100}%`,
            width: `${100 / (1 + PAD * 2)}%`,
            height: `${100 / (1 + PAD * 2)}%`,
          }}
        />
      )}
      <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', position: 'relative' }}>
        <ZoneBox zone={zone} />
      </svg>
      {!dataUrl && (
        <p className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: '#3a4460' }}>
          Not enough data yet
        </p>
      )}
    </div>
  );
}

/** Grid-cell version of the heat gradient: 0 = cold blue, 1 = hot red,
 *  as a solid CSS color with adjustable opacity. */
function gridHeatColor(t: number, alpha: number): string {
  const stops: [number, number, number][] = [
    [29, 78, 216],    // blue (cold / 0%)
    [34, 211, 238],   // cyan
    [234, 179, 8],    // yellow
    [239, 68, 68],    // red (hot)
  ];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = stops[i], b = stops[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgba(${r},${g},${bl},${alpha})`;
}

/** Buckets a zone-relative point into the 5x5 grid - same logic as the
 *  backend's bucket() in report/GET.ts, needed here so we can compute
 *  separate grids for mitt-only and bat-only subsets client-side. */
function bucketPoint(zx: number, zy: number): { row: number; col: number } {
  const idx = (v: number) => {
    if (v < 0) return 0;
    if (v >= 1) return 4;
    return 1 + Math.min(2, Math.floor(v * 3));
  };
  return { row: idx(zy), col: idx(zx) };
}

function computeGrid(pitches: Pitch[]): number[][] {
  const grid: number[][] = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  for (const p of pitches) {
    if (p.zoneX === null || p.zoneY === null) continue;
    const { row, col } = bucketPoint(p.zoneX, p.zoneY);
    grid[row][col]++;
  }
  return grid;
}

function StatsTrio({
  pitches, zone, title, showLegend, highlight,
}: {
  pitches: Pitch[]; zone: ZoneBounds; title: string; showLegend: boolean; highlight?: Pitch | null;
}) {
  const grid = computeGrid(pitches);
  const maxCell = Math.max(1, ...grid.flat());
  const gridTotal = grid.flat().reduce((a, b) => a + b, 0);

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>{title}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
            <Target size={14} style={{ color: '#1d8cf8' }} />
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Pitch Locations</p>
          </div>
          <div className="p-4">
            <LocationPlot pitches={pitches} zone={zone} highlight={highlight} />
            {showLegend && (
              <div className="flex items-center gap-3 mt-3 text-xs flex-wrap" style={{ color: '#6b7a99' }}>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#22c55e' }} /> Strike</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} /> Ball</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f97316' }} /> Contact</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
            <Flame size={14} style={{ color: '#ef4444' }} />
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Heat Map</p>
          </div>
          <div className="p-4">
            <DensityHeatmap pitches={pitches} zone={zone} />
            <p className="text-xs mt-3" style={{ color: '#6b7a99' }}>Brighter = more pitches landed there.</p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
            <Grid3x3 size={14} style={{ color: '#1d8cf8' }} />
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Zone Breakdown</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-5 gap-1">
              {grid.flatMap((row, r) =>
                row.map((count, c) => {
                  const inZone = r >= 1 && r <= 3 && c >= 1 && c <= 3;
                  const pct = gridTotal > 0 ? (count / gridTotal) * 100 : 0;
                  const t = maxCell > 0 ? count / maxCell : 0;
                  return (
                    <div key={`${r}-${c}`} className="flex items-center justify-center rounded"
                         style={{
                           aspectRatio: '1',
                           background: gridHeatColor(t, count > 0 ? 0.9 : 0.35),
                           border: inZone ? '1.5px solid rgba(255,255,255,0.45)' : '1px solid #1a2240',
                         }}>
                      <span className="text-xs font-bold"
                            style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {count > 0 ? `${Math.round(pct)}%` : ''}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>
            <p className="text-xs mt-3" style={{ color: '#6b7a99' }}>
              % of these pitches. Inner 3×3 = strike zone, outer ring = missed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** blue (cold) -> cyan -> yellow -> red (hot), broadcast-style gradient */
function heatRGBA(t: number): [number, number, number, number] {
  if (t <= 0) return [0, 0, 0, 0];
  const stops: [number, number, number, number][] = [
    [29, 78, 216, 0],    // transparent blue at the very edge
    [29, 140, 248, 140],
    [34, 211, 238, 170],
    [234, 179, 8, 200],
    [239, 68, 68, 230],
  ];
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = stops[i], b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(a[3] + (b[3] - a[3]) * f),
  ];
}

// ─── Single pitch: traced path, three views (zone plot / video / edit) ───────

function PitchTrace({ pitch, zone, onUpdated }: { pitch: Pitch; zone: ZoneBounds; onUpdated: () => void }) {
  const [view, setView] = useState<'plane' | 'video'>('plane');
  const [editing, setEditing] = useState(false);
  const pts = pitch.flightPath ?? [];

  if (editing) {
    return (
      <EditPitchPanel
        pitch={pitch}
        zone={zone}
        onDone={(saved) => {
          setEditing(false);
          if (saved) onUpdated();
        }}
      />
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0a0d14', border: '1px solid #1a2240' }}>
      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid #1a2240' }}>
        <button
          onClick={() => setView('plane')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
          style={{ background: view === 'plane' ? 'rgba(29,140,248,0.15)' : 'transparent', color: view === 'plane' ? '#1d8cf8' : '#6b7a99' }}
        >
          <LayoutGrid size={11} /> Zone plot
        </button>
        <button
          onClick={() => setView('video')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
          style={{ background: view === 'video' ? 'rgba(29,140,248,0.15)' : 'transparent', color: view === 'video' ? '#1d8cf8' : '#6b7a99' }}
        >
          <Play size={11} /> Video
        </button>
        <span className="ml-auto text-xs" style={{ color: '#3a4460' }}>{pts.length} detections</span>
        <button
          onClick={() => setEditing(true)}
          disabled={pts.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: pts.length === 0 ? '#3a4460' : '#ef4444',
            border: '1px solid rgba(239,68,68,0.25)',
            opacity: pts.length === 0 ? 0.5 : 1,
            cursor: pts.length === 0 ? 'default' : 'pointer',
          }}
        >
          <Pencil size={11} /> Edit Pitch
        </button>
      </div>

      {view === 'plane' ? (
        <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block' }}>
          <ZoneBox zone={zone} />
          {pts.length > 1 && (
            <motion.polyline
              points={pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke="#1d8cf8" strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          )}
          {pts.map((p, i) => (
            <motion.circle key={i} cx={px(p.x)} cy={py(p.y)} r={0.8} fill="#1d8cf8"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.03, duration: 0.2 }} />
          ))}
          {pitch.frameX !== null && pitch.frameY !== null && (
            <motion.circle cx={px(pitch.frameX)} cy={py(pitch.frameY)} r={2}
                            fill={dotColor(pitch)} stroke="#fff" strokeWidth={0.4}
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, duration: 0.3 }} />
          )}
        </svg>
      ) : (
        <VideoTrace pitch={pitch} />
      )}
    </div>
  );
}

/** Manual detection review: walks backward from the LAST detection (the
 *  current impact point), one at a time. Keep advances to the previous
 *  point unchanged; Delete removes the current point from the working
 *  path and advances to the previous one. Because this is a plain array
 *  filter, deleting a point in the middle naturally reconnects its
 *  neighbors directly -- nothing special needed for that, the polyline
 *  and saved path just skip over whatever's been removed.
 *
 *  Nothing is persisted until Save -- Cancel (or navigating away) at any
 *  point discards the working copy and leaves the stored path untouched. */
function EditPitchPanel({ pitch, zone, onDone }: { pitch: Pitch; zone: ZoneBounds; onDone: (saved: boolean) => void }) {
  const [working, setWorking] = useState<PathPoint[]>(() => [...(pitch.flightPath ?? [])].sort((a, b) => a.frame - b.frame));
  const [cursor, setCursor] = useState(working.length - 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewing = cursor >= 0 && cursor < working.length;
  const current = reviewing ? working[cursor] : null;

  function keep() {
    setCursor((c) => c - 1);
  }

  function del() {
    setWorking((w) => w.filter((_, i) => i !== cursor));
    setCursor((c) => c - 1);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-analyses/${pitch.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flightPath: working }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  const removedCount = (pitch.flightPath?.length ?? 0) - working.length;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0a0d14', border: '1px solid rgba(239,68,68,0.3)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #1a2240' }}>
        <Pencil size={12} style={{ color: '#ef4444' }} />
        <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>Editing detections</span>
        <span className="ml-auto text-xs" style={{ color: '#3a4460' }}>
          {reviewing ? `reviewing ${cursor + 1} / ${working.length}` : 'review complete'}
          {removedCount > 0 && ` · ${removedCount} removed`}
        </span>
      </div>

      <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block' }}>
        <ZoneBox zone={zone} />
        {working.length > 1 && (
          <polyline points={working.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                    fill="none" stroke="#1d8cf8" strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {working.map((p, i) => {
          const isCurrent = i === cursor;
          const isPending = i < cursor; // not yet reached walking backward from the end
          return (
            <circle key={`${p.frame}-${i}`} cx={px(p.x)} cy={py(p.y)}
                    r={isCurrent ? 2.2 : 0.8}
                    fill={isCurrent ? '#eab308' : isPending ? '#3a4460' : '#1d8cf8'}
                    stroke={isCurrent ? '#fff' : 'none'} strokeWidth={isCurrent ? 0.4 : 0} />
          );
        })}
      </svg>

      <div className="p-3 flex flex-col gap-3">
        {reviewing && current && (
          <>
            <p className="text-xs text-center" style={{ color: '#6b7a99' }}>
              Frame {current.frame}{current.conf != null && ` · ${(current.conf * 100).toFixed(0)}% confidence`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={del}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={keep}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <Check size={13} /> Keep
              </button>
            </div>
          </>
        )}

        {!reviewing && (
          <>
            <p className="text-xs text-center" style={{ color: '#6b7a99' }}>
              {working.length > 0
                ? `Reviewed all detections. ${working.length} kept, ${removedCount} removed.`
                : 'All detections removed — this pitch will have no impact point.'}
            </p>
            {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => onDone(false)}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-semibold"
                style={{ background: 'transparent', color: '#6b7a99', border: '1px solid #1a2240' }}
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-semibold"
                style={{ background: '#1d8cf8', color: '#fff', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}

        {reviewing && (
          <button
            onClick={() => onDone(false)}
            className="text-xs self-center"
            style={{ color: '#3a4460' }}
          >
            Cancel editing
          </button>
        )}
      </div>
    </div>
  );
}

/** Converts a sequence of points into a smooth cubic-bezier SVG path that
 *  passes exactly through every point (Catmull-Rom spline, standard
 *  uniform-parametrization conversion to bezier segments). This is what
 *  gives the trace an arc-like look for a real ball flight, while still
 *  hugging whatever the actual detections show if the shape isn't a
 *  perfect parabola -- it interpolates the real data, it doesn't impose
 *  an idealized curve on top of it. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  const d: string[] = [`M ${pts[0].x},${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

/** Video with the ball-detection trail revealed progressively, in sync with
 *  actual playback — a dot appears exactly when the video reaches the
 *  moment that detection happened, not all at once regardless of where
 *  playback is. Falls back to a reasonable default fps for pitches
 *  analyzed before this field started being saved.
 *
 *  Position tracking uses requestAnimationFrame polling of the video's
 *  own currentTime, not the `timeupdate` event — browsers only fire
 *  `timeupdate` a few times a second (commonly throttled to ~250ms
 *  intervals), which is a large, visible lag for a pitch that's on
 *  screen for well under a second. Polling every animation frame keeps
 *  the trace's head matched to the actual ball position. */
function VideoTrace({ pitch }: { pitch: Pitch }) {
  const pts = pitch.flightPath ?? [];
  const fps = pitch.fps ?? 30;
  const [videoOk, setVideoOk] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Only reveal points whose frame has actually been reached by playback.
  const visiblePts = pts.filter((p) => p.frame / fps <= currentTime);
  const svgPts = visiblePts.map((p) => ({ x: p.x * 100, y: p.y * 100 }));
  const curveD = smoothPath(svgPts);

  return (
    <div className="relative inline-block mx-auto" style={{ lineHeight: 0, maxWidth: '100%' }}>
      {videoOk ? (
        <video
          ref={videoRef}
          src={pitch.videoUrl}
          controls
          preload="metadata"
          style={{ display: 'block', maxHeight: 420, maxWidth: '100%', background: '#000' }}
          onError={() => setVideoOk(false)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10" style={{ background: '#000' }}>
          <AlertCircle size={20} style={{ color: '#6b7a99' }} />
          <p className="text-xs" style={{ color: '#6b7a99' }}>Video unavailable</p>
        </div>
      )}
      {videoOk && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
             className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          {curveD && (
            <>
              {/* soft glow: a wider, blurred, translucent duplicate of the
                  curve sitting behind the crisp one — cheap broadcast-style
                  glow without relying on filter primitives */}
              <path d={curveD} fill="none" stroke="#dc2626" strokeWidth={2.4}
                    strokeLinecap="round" strokeLinejoin="round"
                    opacity={0.35} vectorEffect="non-scaling-stroke" />
              <path d={curveD} fill="none" stroke="#f87171" strokeWidth={0.55}
                    strokeLinecap="round" strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      )}
      {videoOk && (
        <p className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded"
           style={{ background: 'rgba(0,0,0,0.6)', color: '#6b7a99' }}>
          Red trace = tracked ball ({visiblePts.length}/{pts.length})
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, isPending } = useSession();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Pitch | null>(null);

  function fetchReport() {
    if (!sessionId) return;
    return fetch(`/api/sessions/${sessionId}/report`, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: Report) => { setReport(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => {
    if (isPending || !sessionId) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isPending]);

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
          <p className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Sign in to view this report</p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Sign In</Link>
        </div>
      </div>
    );
  }

  if (error || !report || report.session.zoneTop === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0d14' }}>
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-4" style={{ color: '#ef4444' }} />
          <p className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Report unavailable</p>
          <p className="text-sm mb-6" style={{ color: '#6b7a99' }}>{error ?? 'Could not load this session.'}</p>
          <Link to="/players" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Back to Players</Link>
        </div>
      </div>
    );
  }

  const { session, summary, pitches } = report;
  const zone: ZoneBounds = { top: session.zoneTop!, bottom: session.zoneBottom!, left: session.zoneLeft!, right: session.zoneRight! };
  const analyzed = pitches.filter((p) => p.frameX !== null);
  const mittPitches = analyzed.filter((p) => !isBat(p));
  const batPitches = analyzed.filter((p) => isBat(p));
  const mittCount = pitches.filter((p) => p.impactType?.toLowerCase() === 'mitt').length;
  const batCount = pitches.filter((p) => isBat(p)).length;
  const showSplit = mittCount > 0 && batCount > 0;

  return (
    <>
      <Helmet>
        <title>Session Report — PitcherML</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-12 px-4" style={{ background: '#0a0d14' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Link to="/players" className="text-xs" style={{ color: '#6b7a99' }}>Players</Link>
            <ChevronRight size={12} style={{ color: '#3a4460' }} />
            <span className="text-xs" style={{ color: '#e8eaf0' }}>Session Report</span>
          </div>

          <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            {session.playerName}
          </h1>
          <p className="text-sm mb-8" style={{ color: '#6b7a99' }}>
            {session.label} · Session #{session.id}
            {batCount > 0 && <> · {mittCount} pitched, {batCount} contact</>}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Pitches', value: summary.total, color: '#1d8cf8' },
              { label: 'Strikes', value: summary.strikes, color: '#22c55e' },
              { label: 'Balls', value: summary.balls, color: '#ef4444' },
              { label: 'Strike %', value: `${summary.strikePct.toFixed(0)}%`, color: '#eab308' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7a99' }}>{s.label}</p>
                <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <StatsTrio
            pitches={analyzed}
            zone={zone}
            title={showSplit ? 'All Pitches (Overlay)' : 'Pitch Locations'}
            showLegend
            highlight={selected}
          />

          {showSplit && (
            <>
              <StatsTrio
                pitches={mittPitches}
                zone={zone}
                title="Pitcher (Mitt)"
                showLegend={false}
                highlight={selected}
              />
              <StatsTrio
                pitches={batPitches}
                zone={zone}
                title="Batter (Contact)"
                showLegend={false}
                highlight={selected}
              />
            </>
          )}

          <h2 className="text-lg font-black mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            Pitch by Pitch
          </h2>
          <div className="flex flex-col gap-4">
            {pitches.map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden"
                   style={{ background: '#0f1420', border: '1px solid #1a2240' }}
                   onMouseEnter={() => setSelected(p)} onMouseLeave={() => setSelected(null)}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #1a2240' }}>
                  <span className="text-sm font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>#{p.pitchNumber}</span>
                  {isBat(p) ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>
                      CONTACT
                    </span>
                  ) : p.isStrike !== null && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{ background: p.isStrike ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: p.isStrike ? '#22c55e' : '#ef4444' }}>
                      {p.isStrike ? 'STRIKE' : 'BALL'}
                    </span>
                  )}
                  {p.status === 'error' && <span className="text-xs" style={{ color: '#f87171' }}>{p.errorMessage ?? 'Failed'}</span>}
                  {p.frameX !== null && p.frameY !== null && (
                    <span className="ml-auto text-xs font-mono" style={{ color: '#3a4460' }}>({p.frameX.toFixed(2)}, {p.frameY.toFixed(2)})</span>
                  )}
                </div>
                {p.status === 'done' && (
                  <div className="p-4">
                    <PitchTrace pitch={p} zone={zone} onUpdated={fetchReport} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
