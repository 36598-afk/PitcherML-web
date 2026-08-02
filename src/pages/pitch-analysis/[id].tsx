import { useEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import {
  ChevronRight, Loader2, AlertCircle, CheckCircle2,
  Target, Zap, Activity, Film, RotateCcw,
} from 'lucide-react';
import { pitch_analysis_result } from 'virtual:content';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathPoint { x: number; y: number }

interface Analysis {
  id: number;
  pitchId: string;
  videoUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  impactType: string | null;
  impactFrame: number | null;
  ballX: number | null;
  ballY: number | null;
  combinedConf: number | null;
  flightPath: string | null;   // JSON string
  pathPoints: string | null;   // JSON string
  errorMessage: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePoints(raw: string | null): PathPoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as PathPoint[];
  } catch { /* ignore */ }
  return [];
}

function confLabel(conf: number | null): string {
  if (conf === null) return '—';
  return `${(conf * 100).toFixed(1)}%`;
}

// ─── Flight Path SVG ──────────────────────────────────────────────────────────

function FlightPathViz({ points, ballX, ballY }: { points: PathPoint[]; ballX: number | null; ballY: number | null }) {
  if (!points.length && ballX === null) {
    return (
      <div className="flex items-center justify-center rounded-lg" style={{ height: 200, background: '#0a0d14', border: '1px solid #1a2240' }}>
        <p className="text-xs" style={{ color: '#3a4460' }}>No path data available</p>
      </div>
    );
  }

  // Normalise points to SVG viewport 0-100
  const allX = points.map((p) => p.x);
  const allY = points.map((p) => p.y);
  if (ballX !== null) { allX.push(ballX); allY.push(ballY ?? 0); }

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad = 10;

  function nx(x: number) { return pad + ((x - minX) / rangeX) * (100 - pad * 2); }
  function ny(y: number) { return (100 - pad) - ((y - minY) / rangeY) * (100 - pad * 2); }

  const pathD = points.length > 1
    ? `M ${points.map((p) => `${nx(p.x)},${ny(p.y)}`).join(' L ')}`
    : '';

  const impactNx = ballX !== null ? nx(ballX) : null;
  const impactNy = ballY !== null ? ny(ballY) : null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0a0d14', border: '1px solid #1a2240' }}>
      <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', aspectRatio: '2/1' }}>
        {/* Grid lines */}
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={100} stroke="#1a2240" strokeWidth={0.4} strokeDasharray="2 2" />
            <line x1={0} y1={v} x2={100} y2={v} stroke="#1a2240" strokeWidth={0.4} strokeDasharray="2 2" />
          </g>
        ))}

        {/* Flight path */}
        {pathD && (
          <motion.path
            d={pathD}
            fill="none"
            stroke="#1d8cf8"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' as const }}
          />
        )}

        {/* Tracked dots */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={nx(p.x)}
            cy={ny(p.y)}
            r={1.2}
            fill="#1d8cf8"
            opacity={0.5 + (i / points.length) * 0.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
          />
        ))}

        {/* Impact point */}
        {impactNx !== null && impactNy !== null && (
          <g>
            <motion.circle
              cx={impactNx}
              cy={impactNy}
              r={4}
              fill="none"
              stroke="#22c55e"
              strokeWidth={1}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            />
            <motion.circle
              cx={impactNx}
              cy={impactNy}
              r={2}
              fill="#22c55e"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.3 }}
            />
          </g>
        )}
      </svg>

      <div className="px-4 py-2 flex items-center gap-4 text-xs" style={{ borderTop: '1px solid #1a2240' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ background: '#1d8cf8', display: 'inline-block' }} />
          <span style={{ color: '#6b7a99' }}>Ball path ({points.length} frames)</span>
        </span>
        {impactNx !== null && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-green-500 inline-block" />
            <span style={{ color: '#6b7a99' }}>Impact point</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon: Icon, color }: {
  label: string;
  value: string | number | null;
  unit?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: value !== null ? '#e8eaf0' : '#3a4460' }}>
        {value !== null ? value : '—'}
        {value !== null && unit && (
          <span className="text-sm font-normal ml-1" style={{ color: '#6b7a99' }}>{unit}</span>
        )}
      </p>
    </div>
  );
}

// ─── Impact Badge ─────────────────────────────────────────────────────────────

function ImpactBadge({ type }: { type: string | null }) {
  if (!type) return null;

  const isMitt = type.toLowerCase() === 'mitt';
  const isBat = type.toLowerCase() === 'bat';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
      className="flex items-center gap-3 rounded-xl px-6 py-4"
      style={{
        background: isMitt
          ? 'rgba(34,197,94,0.08)'
          : isBat
            ? 'rgba(249,115,22,0.08)'
            : 'rgba(29,140,248,0.08)',
        border: `1.5px solid ${isMitt ? 'rgba(34,197,94,0.3)' : isBat ? 'rgba(249,115,22,0.3)' : 'rgba(29,140,248,0.3)'}`,
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isMitt
            ? 'rgba(34,197,94,0.15)'
            : isBat
              ? 'rgba(249,115,22,0.15)'
              : 'rgba(29,140,248,0.15)',
        }}
      >
        {isMitt && <Target size={22} style={{ color: '#22c55e' }} />}
        {isBat && <Activity size={22} style={{ color: '#f97316' }} />}
        {!isMitt && !isBat && <Zap size={22} style={{ color: '#1d8cf8' }} />}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#6b7a99' }}>
          Impact detected
        </p>
        <p className="text-2xl font-black capitalize" style={{
          fontFamily: 'var(--font-heading)',
          color: isMitt ? '#22c55e' : isBat ? '#f97316' : '#1d8cf8',
        }}>
          {type}
          {isMitt && ' — Strike'}
          {isBat && ' — Contact'}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PitchAnalysisResultPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isPending } = useSession();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !id) return;
    setLoading(true);
    fetch(`/api/video-analyses/${id}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ analysis: Analysis }>;
      })
      .then(({ analysis: a }) => { setAnalysis(a); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [id, isPending]);

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
          <p className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Sign in to view results</p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Sign In</Link>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0d14' }}>
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-4" style={{ color: '#ef4444' }} />
          <p className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>Analysis not found</p>
          <p className="text-sm mb-6" style={{ color: '#6b7a99' }}>{error ?? 'This analysis does not exist or you do not have access.'}</p>
          <Link to="/pitch-analysis" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>Back to Upload</Link>
        </div>
      </div>
    );
  }

  const flightPath = parsePoints(analysis.flightPath);
  const pathPoints = parsePoints(analysis.pathPoints);
  const displayPoints = flightPath.length ? flightPath : pathPoints;

  const isProcessing = analysis.status === 'pending' || analysis.status === 'processing';
  const isError = analysis.status === 'error';
  const isDone = analysis.status === 'done';

  return (
    <>
      <Helmet>
        <title>Pitch Analysis Result — PitcherML</title>
        <meta name="description" content="AI pitch analysis result — ball tracking, impact detection, and flight path." />
        <link rel="canonical" href={`/pitch-analysis/${id}`} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-12 px-4" style={{ background: '#0a0d14' }}>
        <div className="max-w-3xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6">
            <Link to="/dashboard" className="text-xs" style={{ color: '#6b7a99' }}>Dashboard</Link>
            <ChevronRight size={12} style={{ color: '#3a4460' }} />
            <Link to="/pitch-analysis" className="text-xs" style={{ color: '#6b7a99' }}>Pitch Analysis</Link>
            <ChevronRight size={12} style={{ color: '#3a4460' }} />
            <span className="text-xs" style={{ color: '#e8eaf0' }}>Result #{analysis.id}</span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                {pitch_analysis_result.title}
              </h1>
              <p className="text-sm" style={{ color: '#6b7a99' }}>
                {new Date(analysis.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div
              className="px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
              style={{
                background: isDone
                  ? 'rgba(34,197,94,0.1)'
                  : isError
                    ? 'rgba(239,68,68,0.1)'
                    : 'rgba(29,140,248,0.1)',
                color: isDone ? '#22c55e' : isError ? '#ef4444' : '#1d8cf8',
                border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : isError ? 'rgba(239,68,68,0.3)' : 'rgba(29,140,248,0.3)'}`,
              }}
            >
              {isDone ? 'Complete' : isError ? 'Failed' : 'Processing…'}
            </div>
          </div>

          {/* Processing state */}
          {isProcessing && (
            <div className="rounded-xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#1d8cf8' }} />
              <p className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>{pitch_analysis_result.processingTitle}</p>
              <p className="text-sm" style={{ color: '#6b7a99' }}>{pitch_analysis_result.processingSubtitle}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
                style={{ background: 'rgba(29,140,248,0.1)', color: '#1d8cf8', border: '1px solid rgba(29,140,248,0.2)' }}
              >
                <RotateCcw size={13} />
                Refresh
              </button>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: '#0f1420', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-base font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>{pitch_analysis_result.errorTitle}</p>
                  <p className="text-sm" style={{ color: '#f87171' }}>{analysis.errorMessage ?? 'An unknown error occurred.'}</p>
                </div>
              </div>
              <Link
                to="/pitch-analysis"
                className="self-start px-4 py-2 rounded text-sm font-semibold"
                style={{ background: '#1d8cf8', color: '#fff' }}
              >
                Try another video
              </Link>
            </div>
          )}

          {/* Success results */}
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' as const }}
              className="flex flex-col gap-5"
            >
              {/* Impact type hero */}
              <ImpactBadge type={analysis.impactType} />

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Impact Frame"
                  value={analysis.impactFrame}
                  icon={Film}
                  color="#1d8cf8"
                />
                <StatCard
                  label="Confidence"
                  value={confLabel(analysis.combinedConf)}
                  icon={CheckCircle2}
                  color="#22c55e"
                />
                <StatCard
                  label="Ball X"
                  value={analysis.ballX !== null ? analysis.ballX.toFixed(3) : null}
                  icon={Target}
                  color="#a855f7"
                />
                <StatCard
                  label="Ball Y"
                  value={analysis.ballY !== null ? analysis.ballY.toFixed(3) : null}
                  icon={Target}
                  color="#a855f7"
                />
              </div>

              {/* Flight path visualization */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid #1a2240' }}>
                  <Activity size={14} style={{ color: '#1d8cf8' }} />
                  <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                    {pitch_analysis_result.flightPathTitle}
                  </p>
                  {displayPoints.length > 0 && (
                    <span className="ml-auto text-xs" style={{ color: '#6b7a99' }}>
                      {displayPoints.length} tracked positions
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <FlightPathViz
                    points={displayPoints}
                    ballX={analysis.ballX}
                    ballY={analysis.ballY}
                  />
                </div>
              </div>

              {/* Raw data accordion */}
              <details className="rounded-xl overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                <summary
                  className="px-5 py-3.5 text-sm font-semibold cursor-pointer select-none"
                  style={{ fontFamily: 'var(--font-heading)', color: '#6b7a99' }}
                >
                  {pitch_analysis_result.rawDataLabel}
                </summary>
                <div className="px-5 pb-5">
                  <pre
                    className="text-xs rounded-lg p-4 overflow-x-auto"
                    style={{ background: '#0a0d14', color: '#6b7a99', border: '1px solid #1a2240', fontFamily: 'monospace' }}
                  >
                    {JSON.stringify({
                      impact_type: analysis.impactType,
                      impact_frame: analysis.impactFrame,
                      ball_x: analysis.ballX,
                      ball_y: analysis.ballY,
                      combined_conf: analysis.combinedConf,
                      flight_path: flightPath,
                      path_points: pathPoints,
                    }, null, 2)}
                  </pre>
                </div>
              </details>

              {/* Actions */}
              <div className="flex gap-3">
                <Link
                  to="/pitch-analysis"
                  className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm"
                  style={{ background: '#1d8cf8', color: '#fff' }}
                >
                  <Film size={14} />
                  {pitch_analysis_result.analyzeAnotherButton}
                </Link>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm"
                  style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
                >
                  {pitch_analysis_result.backButton}
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
