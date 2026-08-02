import { useEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import { Loader2, AlertCircle, ChevronRight, Target, Grid3x3, Flame, Play, LayoutGrid } from 'lucide-react';

/**
 * End-of-session report.
 *
 * Everything here is drawn in ZONE-RELATIVE space: (0,0) is the top-left of
 * the calibrated strike zone and (1,1) is the bottom-right, so a pitch at
 * (0.5, 0.5) caught the middle and anything outside 0-1 missed. The zone is
 * drawn centred and impacts are positioned around it like a coordinate plane.
 */

interface PathPoint { frame: number; x: number; y: number; zx: number; zy: number; conf?: number }

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
  frameHeight: number | null;
  zoneX: number | null;
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

// The plot spans -1 to 2 in zone space (one full zone-width of margin on each
// side), so misses stay visible instead of being clipped off the edge.
const PLOT_MIN = -1;
const PLOT_MAX = 2;
const SPAN = PLOT_MAX - PLOT_MIN;

/** zone-space -> 0-100 SVG percentage */
function plotX(zx: number) { return ((zx - PLOT_MIN) / SPAN) * 100; }
function plotY(zy: number) { return ((zy - PLOT_MIN) / SPAN) * 100; }

function heatColor(t: number): string {
  // 0 -> deep blue, 0.5 -> cyan/yellow, 1 -> red
  if (t <= 0) return 'rgba(29,140,248,0.10)';
  if (t < 0.4) return `rgba(29,140,248,${0.25 + t})`;
  if (t < 0.7) return `rgba(234,179,8,${0.35 + t * 0.4})`;
  return `rgba(239,68,68,${0.4 + t * 0.5})`;
}

// ─── Coordinate-plane plot ────────────────────────────────────────────────────

function ZonePlot({ pitches, highlight }: { pitches: Pitch[]; highlight?: Pitch | null }) {
  const zl = plotX(0), zr = plotX(1), zt = plotY(0), zb = plotY(1);

  return (
    <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', background: '#0a0d14', borderRadius: 8 }}>
      {/* zone box */}
      <rect x={zl} y={zt} width={zr - zl} height={zb - zt}
            fill="rgba(29,140,248,0.06)" stroke="#1d8cf8" strokeWidth={0.6} />
      {/* inner thirds */}
      {[1, 2].map((i) => (
        <g key={i}>
          <line x1={plotX(i / 3)} y1={zt} x2={plotX(i / 3)} y2={zb} stroke="#1d8cf8" strokeWidth={0.25} opacity={0.5} />
          <line x1={zl} y1={plotY(i / 3)} x2={zr} y2={plotY(i / 3)} stroke="#1d8cf8" strokeWidth={0.25} opacity={0.5} />
        </g>
      ))}

      {pitches.map((p) => {
        if (p.zoneX === null || p.zoneY === null) return null;
        const isHi = highlight && highlight.id === p.id;
        return (
          <g key={p.id}>
            <circle
              cx={plotX(p.zoneX)} cy={plotY(p.zoneY)}
              r={isHi ? 2.6 : 1.7}
              fill={p.isStrike ? '#22c55e' : '#ef4444'}
              stroke={isHi ? '#fff' : 'rgba(0,0,0,0.4)'}
              strokeWidth={isHi ? 0.8 : 0.3}
              opacity={highlight && !isHi ? 0.25 : 0.9}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Single pitch: traced path, two views ─────────────────────────────────────

function PitchTrace({ pitch }: { pitch: Pitch }) {
  const [view, setView] = useState<'plane' | 'video'>('plane');
  const pts = pitch.flightPath ?? [];

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0a0d14', border: '1px solid #1a2240' }}>
      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid #1a2240' }}>
        <button
          onClick={() => setView('plane')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
          style={{
            background: view === 'plane' ? 'rgba(29,140,248,0.15)' : 'transparent',
            color: view === 'plane' ? '#1d8cf8' : '#6b7a99',
          }}
        >
          <LayoutGrid size={11} /> Zone plot
        </button>
        <button
          onClick={() => setView('video')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
          style={{
            background: view === 'video' ? 'rgba(29,140,248,0.15)' : 'transparent',
            color: view === 'video' ? '#1d8cf8' : '#6b7a99',
          }}
        >
          <Play size={11} /> Video
        </button>
        <span className="ml-auto text-xs" style={{ color: '#3a4460' }}>
          {pts.length} detections
        </span>
      </div>

      {view === 'plane' ? (
        <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block' }}>
          {/* zone as context */}
          <rect x={plotX(0)} y={plotY(0)} width={plotX(1) - plotX(0)} height={plotY(1) - plotY(0)}
                fill="rgba(29,140,248,0.06)" stroke="#1d8cf8" strokeWidth={0.6} />
          {[1, 2].map((i) => (
            <g key={i}>
              <line x1={plotX(i / 3)} y1={plotY(0)} x2={plotX(i / 3)} y2={plotY(1)} stroke="#1d8cf8" strokeWidth={0.25} opacity={0.5} />
              <line x1={plotX(0)} y1={plotY(i / 3)} x2={plotX(1)} y2={plotY(i / 3)} stroke="#1d8cf8" strokeWidth={0.25} opacity={0.5} />
            </g>
          ))}

          {/* traced flight path, detection to detection */}
          {pts.length > 1 && (
            <motion.polyline
              points={pts.map((p) => `${plotX(p.zx)},${plotY(p.zy)}`).join(' ')}
              fill="none" stroke="#1d8cf8" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          )}
          {pts.map((p, i) => (
            <motion.circle
              key={i} cx={plotX(p.zx)} cy={plotY(p.zy)} r={0.9} fill="#1d8cf8"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.03, duration: 0.2 }}
            />
          ))}
          {/* impact */}
          {pitch.zoneX !== null && pitch.zoneY !== null && (
            <motion.circle
              cx={plotX(pitch.zoneX)} cy={plotY(pitch.zoneY)} r={2.2}
              fill={pitch.isStrike ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={0.5}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, duration: 0.3 }}
            />
          )}
        </svg>
      ) : (
        <VideoTrace pitch={pitch} />
      )}
    </div>
  );
}

/** Video with the detection dots and zone drawn over it, in frame space. */
function VideoTrace({ pitch }: { pitch: Pitch }) {
  const pts = pitch.flightPath ?? [];
  return (
    <div className="relative" style={{ lineHeight: 0 }}>
      <video src={pitch.videoUrl} controls className="w-full" style={{ maxHeight: 420, background: '#000' }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                    fill="none" stroke="#1d8cf8" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x * 100} cy={p.y * 100} r={0.7} fill="#1d8cf8" />
        ))}
      </svg>
      <p className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded"
         style={{ background: 'rgba(0,0,0,0.6)', color: '#6b7a99' }}>
        Blue dots = tracked ball
      </p>
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

  useEffect(() => {
    if (isPending || !sessionId) return;
    fetch(`/api/sessions/${sessionId}/report`, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: Report) => { setReport(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
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

  if (error || !report) {
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

  const { session, summary, grid, pitches } = report;
  const maxCell = Math.max(1, ...grid.flat());
  const analyzed = pitches.filter((p) => p.zoneX !== null);

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
          <p className="text-sm mb-8" style={{ color: '#6b7a99' }}>{session.label} · Session #{session.id}</p>

          {/* Summary */}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            {/* Locations */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
                <Target size={14} style={{ color: '#1d8cf8' }} />
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Pitch Locations</p>
              </div>
              <div className="p-4">
                <ZonePlot pitches={analyzed} highlight={selected} />
                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: '#6b7a99' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#22c55e' }} /> Strike
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} /> Ball
                  </span>
                </div>
              </div>
            </div>

            {/* 5x5 grid: 3x3 zone + outside ring */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
                <Grid3x3 size={14} style={{ color: '#1d8cf8' }} />
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Zone Breakdown</p>
                <span className="ml-auto text-xs" style={{ color: '#3a4460' }}>inner 3×3 = strike zone</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 gap-1">
                  {grid.flatMap((row, r) =>
                    row.map((count, c) => {
                      const inZone = r >= 1 && r <= 3 && c >= 1 && c <= 3;
                      const t = count / maxCell;
                      return (
                        <div
                          key={`${r}-${c}`}
                          className="flex items-center justify-center rounded"
                          style={{
                            aspectRatio: '1',
                            background: count > 0 ? heatColor(t) : 'rgba(255,255,255,0.02)',
                            border: inZone ? '1px solid rgba(29,140,248,0.5)' : '1px solid #1a2240',
                          }}
                        >
                          <span className="text-xs font-bold"
                                style={{ color: count > 0 ? '#fff' : '#2d3748' }}>
                            {count > 0 ? count : ''}
                          </span>
                        </div>
                      );
                    }),
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#6b7a99' }}>
                  <Flame size={11} style={{ color: '#ef4444' }} />
                  Brighter = more pitches. Outer ring = missed the zone.
                </div>
              </div>
            </div>
          </div>

          {/* Pitch by pitch */}
          <h2 className="text-lg font-black mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            Pitch by Pitch
          </h2>
          <div className="flex flex-col gap-4">
            {pitches.map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden"
                   style={{ background: '#0f1420', border: '1px solid #1a2240' }}
                   onMouseEnter={() => setSelected(p)} onMouseLeave={() => setSelected(null)}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #1a2240' }}>
                  <span className="text-sm font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                    #{p.pitchNumber}
                  </span>
                  {p.isStrike !== null && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            background: p.isStrike ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: p.isStrike ? '#22c55e' : '#ef4444',
                          }}>
                      {p.isStrike ? 'STRIKE' : 'BALL'}
                    </span>
                  )}
                  {p.impactType && (
                    <span className="text-xs capitalize" style={{ color: '#6b7a99' }}>{p.impactType}</span>
                  )}
                  {p.status === 'error' && (
                    <span className="text-xs" style={{ color: '#f87171' }}>{p.errorMessage ?? 'Failed'}</span>
                  )}
                  {p.zoneX !== null && p.zoneY !== null && (
                    <span className="ml-auto text-xs font-mono" style={{ color: '#3a4460' }}>
                      ({p.zoneX.toFixed(2)}, {p.zoneY.toFixed(2)})
                    </span>
                  )}
                </div>
                {p.status === 'done' && (
                  <div className="p-4">
                    <PitchTrace pitch={p} />
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
