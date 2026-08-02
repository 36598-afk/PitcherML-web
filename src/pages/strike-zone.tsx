/**
 * /strike-zone — Full-page strike zone & heat map analysis
 * Shows pitch location data across sessions with multiple view modes,
 * filters by pitch type / result / session, and zone breakdown stats.
 */

import { useEffect, useState, useMemo } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import { ChevronRight, Loader2, ChevronDown, Target, Activity, Filter, RotateCcw } from 'lucide-react';
import StrikeZone, { PITCH_COLORS, type PitchDot, type ViewMode } from '@/components/dashboard/StrikeZone';
import { strike_zone } from 'virtual:content';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player { id: number; name: string; position: string; team: string | null; throws: string }
interface PitchSession { id: number; label: string | null; sessionDate: string; totalPitches: number }
interface RawPitch {
  id: number; sessionId: number; pitchType: string; velocity: number | null;
  spinRate: number | null; locationX: number | null; locationY: number | null;
  result: string; count: string; pitchNumber: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const RESULTS = ['strike', 'ball', 'foul', 'swinging_strike', 'hit'];
// RESULT_LABELS sourced from strike_zone.resultLabels (virtual:content)
const RESULT_COLORS: Record<string, string> = {
  strike: '#22c55e', ball: '#ef4444', foul: '#f59e0b',
  swinging_strike: '#a855f7', hit: '#f97316',
};

// ─── Zone breakdown stats ─────────────────────────────────────────────────────

function ZoneBreakdown({ pitches }: { pitches: PitchDot[] }) {
  const total = pitches.length;
  if (!total) return null;

  // 9-zone grid counts
  const zones = Array.from({ length: 9 }, () => ({ total: 0, strikes: 0 }));
  for (const p of pitches) {
    const col = p.x < -1 / 3 ? 0 : p.x < 1 / 3 ? 1 : 2;
    const row = p.y < 1 / 3 ? 2 : p.y < 2 / 3 ? 1 : 0;
    const idx = row * 3 + col;
    zones[idx].total++;
    if (p.result === 'strike' || p.result === 'swinging_strike') zones[idx].strikes++;
  }

  const zoneLabels = ['Up & In', 'Up', 'Up & Out', 'Mid In', 'Middle', 'Mid Out', 'Low In', 'Low', 'Low Out'];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
        Zone breakdown
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {zones.map((z, i) => {
          const strikeRate = z.total ? z.strikes / z.total : 0;
          return (
            <div
              key={i}
              className="rounded p-2 text-center"
              style={{
                background: z.total > 0
                  ? `rgba(29,140,248,${0.05 + (z.total / Math.max(...zones.map((z2) => z2.total), 1)) * 0.2})`
                  : '#0a0d14',
                border: '1px solid #1a2240',
              }}
            >
              <p className="text-xs font-black" style={{ fontFamily: 'var(--font-heading)', color: z.total > 0 ? '#e8eaf0' : '#3a4460' }}>
                {z.total}
              </p>
              <p className="text-xs" style={{ color: '#3a4460', fontSize: 9 }}>{zoneLabels[i]}</p>
              {z.total > 0 && (
                <p className="text-xs font-semibold" style={{ color: '#22c55e', fontSize: 9 }}>
                  {Math.round(strikeRate * 100)}% K
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pitch type breakdown ─────────────────────────────────────────────────────

function TypeBreakdown({ pitches }: { pitches: PitchDot[] }) {
  const total = pitches.length;
  if (!total) return null;

  const counts: Record<string, { total: number; strikes: number; avgVelo: number; veloCount: number }> = {};
  for (const p of pitches) {
    if (!counts[p.type]) counts[p.type] = { total: 0, strikes: 0, avgVelo: 0, veloCount: 0 };
    counts[p.type].total++;
    if (p.result === 'strike' || p.result === 'swinging_strike') counts[p.type].strikes++;
    if (p.velocity) { counts[p.type].avgVelo += p.velocity; counts[p.type].veloCount++; }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
        Pitch type breakdown
      </p>
      <div className="flex flex-col gap-2">
        {sorted.map(([type, data]) => {
          const color = PITCH_COLORS[type] ?? '#94a3b8';
          const pct = data.total / total;
          const strikeRate = data.total ? data.strikes / data.total : 0;
          const avgVelo = data.veloCount ? data.avgVelo / data.veloCount : null;
          return (
            <div key={type} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs font-semibold" style={{ color: '#e8eaf0' }}>{type}</span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: '#6b7a99' }}>
                  {avgVelo && <span style={{ color: '#1d8cf8' }}>{avgVelo.toFixed(1)} mph</span>}
                  <span style={{ color: '#22c55e' }}>{Math.round(strikeRate * 100)}% K</span>
                  <span className="font-semibold" style={{ color: '#e8eaf0' }}>{data.total}</span>
                </div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ background: '#1a2240', height: 4 }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' as const }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result breakdown ─────────────────────────────────────────────────────────

function ResultBreakdown({ pitches }: { pitches: PitchDot[] }) {
  const total = pitches.length;
  if (!total) return null;

  const counts: Record<string, number> = {};
  for (const p of pitches) counts[p.result] = (counts[p.result] ?? 0) + 1;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
        Result breakdown
      </p>
      <div className="flex flex-col gap-2">
        {RESULTS.filter((r) => counts[r]).map((r) => {
          const n = counts[r] ?? 0;
          const color = RESULT_COLORS[r];
          const label = (strike_zone.resultLabels as Record<string, string>)[r] ?? r;
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="text-xs w-24 flex-shrink-0" style={{ color: '#6b7a99' }}>{label}</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1a2240', height: 5 }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / total) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' as const }}
                />
              </div>
              <span className="text-xs w-6 text-right flex-shrink-0 font-semibold" style={{ color: '#e8eaf0' }}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

function SummaryStats({ pitches }: { pitches: PitchDot[] }) {
  const total = pitches.length;
  const strikes = pitches.filter((p) => p.result === 'strike' || p.result === 'swinging_strike').length;
  const balls = pitches.filter((p) => p.result === 'ball').length;
  const inZone = pitches.filter((p) => p.x >= -1 && p.x <= 1 && p.y >= 0 && p.y <= 1).length;
  const veloArr = pitches.filter((p) => p.velocity).map((p) => p.velocity!);
  const avgVelo = veloArr.length ? veloArr.reduce((a, b) => a + b, 0) / veloArr.length : null;

  const stats = [
    { label: 'Pitches', value: total, color: '#e8eaf0' },
    { label: 'Strike%', value: total ? `${Math.round((strikes / total) * 100)}%` : '—', color: '#22c55e' },
    { label: 'Ball%', value: total ? `${Math.round((balls / total) * 100)}%` : '—', color: '#ef4444' },
    { label: 'Zone%', value: total ? `${Math.round((inZone / total) * 100)}%` : '—', color: '#1d8cf8' },
    { label: 'Avg Velo', value: avgVelo ? `${avgVelo.toFixed(1)}` : '—', unit: 'mph', color: '#1d8cf8' },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map(({ label, value, unit, color }) => (
        <div key={label} className="rounded-lg p-3 text-center" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
          <p className="text-xs mb-1" style={{ color: '#6b7a99' }}>{label}</p>
          <p className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color }}>
            {value}
            {unit && value !== '—' && <span className="text-xs font-normal ml-0.5" style={{ color: '#6b7a99' }}>{unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StrikeZonePage() {
  const { user, isPending } = useSession();

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<PitchSession[]>([]);
  const [rawPitches, setRawPitches] = useState<RawPitch[]>([]);

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('dots');

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingPitches, setLoadingPitches] = useState(false);

  // Load players
  useEffect(() => {
    if (isPending) return;
    fetch('/api/players', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: Player[]) => { setPlayers(Array.isArray(d) ? d : []); setLoadingPlayers(false); })
      .catch(() => setLoadingPlayers(false));
  }, [isPending]);

  // Load sessions when player changes
  useEffect(() => {
    if (!selectedPlayerId) { setSessions([]); setRawPitches([]); return; }
    setLoadingSessions(true);
    fetch(`/api/players/${selectedPlayerId}/sessions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: PitchSession[]) => { setSessions(Array.isArray(d) ? d : []); setLoadingSessions(false); })
      .catch(() => setLoadingSessions(false));
    setSelectedSessionId('all');
    setSelectedType('all');
    setSelectedResult('all');
  }, [selectedPlayerId]);

  // Load pitches when player or session filter changes
  useEffect(() => {
    if (!selectedPlayerId) { setRawPitches([]); return; }
    setLoadingPitches(true);
    const url = selectedSessionId !== 'all'
      ? `/api/players/${selectedPlayerId}/pitches?sessionId=${selectedSessionId}`
      : `/api/players/${selectedPlayerId}/pitches`;
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: RawPitch[]) => { setRawPitches(Array.isArray(d) ? d : []); setLoadingPitches(false); })
      .catch(() => setLoadingPitches(false));
  }, [selectedPlayerId, selectedSessionId]);

  // Build pitch dots with client-side type/result filters
  const pitchDots = useMemo<PitchDot[]>(() => {
    return rawPitches
      .filter((p) => p.locationX !== null && p.locationY !== null)
      .filter((p) => selectedType === 'all' || p.pitchType === selectedType)
      .filter((p) => selectedResult === 'all' || p.result === selectedResult)
      .map((p, i) => ({
        id: i + 1,
        x: p.locationX!,
        y: p.locationY!,
        type: p.pitchType,
        result: p.result,
        velocity: p.velocity,
      }));
  }, [rawPitches, selectedType, selectedResult]);

  const presentTypes = useMemo(
    () => [...new Set(rawPitches.map((p) => p.pitchType))],
    [rawPitches],
  );

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

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
            Sign in to view strike zone analysis
          </p>
          <Link to="/login" className="px-6 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Strike Zone & Heat Maps — PitcherML</title>
        <meta name="description" content="Interactive strike zone analysis with pitch location plotting, heat map overlays, and zone breakdown statistics." />
        <link rel="canonical" href="https://pitcherml.com/strike-zone" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0a0d14' }}>

        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: '#0f1420', borderBottom: '1px solid #1a2240' }}>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
              Pitcher<span style={{ color: '#1d8cf8' }}>ML</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1" aria-label="Strike zone navigation">
              {[
                { to: '/dashboard', label: 'Dashboard' },
                { to: '/players', label: 'Players' },
                { to: '/strike-zone', label: 'Strike Zone', active: true },
                { to: '/pitch-analysis', label: 'Video Analysis' },
              ].map(({ to, label, active }) => (
                <Link key={to} to={to}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                  style={{ background: active ? 'rgba(29,140,248,0.12)' : 'transparent', color: active ? '#1d8cf8' : '#6b7a99' }}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: '#3a4460' }}>
            <Link to="/dashboard" style={{ color: '#6b7a99' }}>Dashboard</Link>
            <ChevronRight size={11} />
            <span style={{ color: '#e8eaf0' }}>Strike Zone</span>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar — filters */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ borderRight: '1px solid #1a2240', background: '#0a0d14' }}>

            <div className="p-4 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>
                  {strike_zone.filters.playerLabel}
                </p>
                {loadingPlayers ? (
                  <div className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" style={{ color: '#1d8cf8' }} /><span className="text-xs" style={{ color: '#6b7a99' }}>Loading…</span></div>
                ) : players.length === 0 ? (
                  <div>
                    <p className="text-xs mb-2" style={{ color: '#6b7a99' }}>No players yet.</p>
                    <Link to="/players" className="text-xs font-semibold" style={{ color: '#1d8cf8' }}>Add a player →</Link>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedPlayerId ?? ''}
                      onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded text-sm outline-none appearance-none pr-8"
                      style={{ background: '#0f1420', border: '1px solid #1a2240', color: '#e8eaf0', fontFamily: 'var(--font-sans)' }}
                    >
                      <option value="">Select player…</option>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b7a99' }} />
                  </div>
                )}
              </div>

              {selectedPlayerId && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>
                      {strike_zone.filters.sessionLabel}
                    </p>
                    {loadingSessions ? (
                      <div className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" style={{ color: '#1d8cf8' }} /><span className="text-xs" style={{ color: '#6b7a99' }}>Loading…</span></div>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedSessionId}
                          onChange={(e) => setSelectedSessionId(e.target.value)}
                          className="w-full px-3 py-2 rounded text-sm outline-none appearance-none pr-8"
                          style={{ background: '#0f1420', border: '1px solid #1a2240', color: '#e8eaf0', fontFamily: 'var(--font-sans)' }}
                        >
                          <option value="all">All sessions</option>
                          {sessions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label || fmtDate(s.sessionDate)} ({s.totalPitches})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b7a99' }} />
                      </div>
                    )}
                  </div>

                  {/* Pitch type filter */}
                  {presentTypes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>
                        {strike_zone.filters.pitchTypeLabel}
                      </p>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setSelectedType('all')}
                          className="w-full text-left px-2.5 py-1.5 rounded text-xs font-semibold transition-all"
                          style={{
                            background: selectedType === 'all' ? 'rgba(29,140,248,0.12)' : 'transparent',
                            color: selectedType === 'all' ? '#1d8cf8' : '#6b7a99',
                          }}
                        >
                          All types
                        </button>
                        {presentTypes.map((t) => (
                          <button
                            key={t}
                            onClick={() => setSelectedType(t === selectedType ? 'all' : t)}
                            className="w-full text-left px-2.5 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-2"
                            style={{
                              background: selectedType === t ? `${PITCH_COLORS[t] ?? '#94a3b8'}18` : 'transparent',
                              color: selectedType === t ? (PITCH_COLORS[t] ?? '#94a3b8') : '#6b7a99',
                            }}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PITCH_COLORS[t] ?? '#94a3b8' }} />
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Result filter */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>
                      {strike_zone.filters.resultLabel}
                    </p>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setSelectedResult('all')}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs font-semibold transition-all"
                        style={{
                          background: selectedResult === 'all' ? 'rgba(29,140,248,0.12)' : 'transparent',
                          color: selectedResult === 'all' ? '#1d8cf8' : '#6b7a99',
                        }}
                      >
                        All results
                      </button>
                      {RESULTS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setSelectedResult(r === selectedResult ? 'all' : r)}
                          className="w-full text-left px-2.5 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-2"
                          style={{
                            background: selectedResult === r ? `${RESULT_COLORS[r]}18` : 'transparent',
                            color: selectedResult === r ? RESULT_COLORS[r] : '#6b7a99',
                          }}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RESULT_COLORS[r] }} />
                          {(strike_zone.resultLabels as Record<string, string>)[r] ?? r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reset */}
                  {(selectedType !== 'all' || selectedResult !== 'all' || selectedSessionId !== 'all') && (
                    <button
                      onClick={() => { setSelectedType('all'); setSelectedResult('all'); setSelectedSessionId('all'); }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <RotateCcw size={11} />
                      Reset filters
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedPlayerId ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                  style={{ background: 'rgba(29,140,248,0.06)', border: '1.5px solid rgba(29,140,248,0.15)' }}>
                  <Target size={36} style={{ color: 'rgba(29,140,248,0.35)' }} />
                </div>
                <p className="text-xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#3a4460' }}>
                  {strike_zone.empty.title}
                </p>
                <p className="text-sm" style={{ color: '#3a4460' }}>
                  {strike_zone.empty.subtitle}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 max-w-5xl">

                {/* Page header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                      {strike_zone.page.title}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: '#6b7a99' }}>
                      {selectedPlayer?.name}
                      {selectedSessionId !== 'all'
                        ? ` · ${sessions.find((s) => s.id === Number(selectedSessionId))?.label || 'Session'}`
                        : ` · All sessions`}
                      {(selectedType !== 'all' || selectedResult !== 'all') && (
                        <span style={{ color: '#1d8cf8' }}>
                          {selectedType !== 'all' ? ` · ${selectedType}` : ''}
                          {selectedResult !== 'all' ? ` · ${(strike_zone.resultLabels as Record<string, string>)[selectedResult] ?? selectedResult}` : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* View mode toggle */}
                  <div className="flex rounded overflow-hidden flex-shrink-0" style={{ border: '1px solid #1a2240' }}>
                    {([
                      { key: 'dots', icon: Target, label: 'Dots' },
                      { key: 'heat', icon: Activity, label: 'Heat' },
                      { key: 'type', icon: Filter, label: 'By Type' },
                    ] as { key: ViewMode; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setViewMode(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: viewMode === key ? 'rgba(29,140,248,0.15)' : 'transparent',
                          color: viewMode === key ? '#1d8cf8' : '#6b7a99',
                        }}
                      >
                        <Icon size={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary stats */}
                {!loadingPitches && <SummaryStats pitches={pitchDots} />}

                {/* Main grid: zone + stats */}
                {loadingPitches ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={24} className="animate-spin" style={{ color: '#1d8cf8' }} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Strike zone */}
                    <div className="lg:col-span-1 rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>
                          {viewMode === 'heat' ? strike_zone.page.heatMapLabel : strike_zone.page.locationLabel}
                        </p>
                        <span className="text-xs" style={{ color: '#3a4460' }}>
                          {pitchDots.length} pitch{pitchDots.length !== 1 ? 'es' : ''}
                        </span>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${viewMode}-${selectedType}-${selectedResult}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <StrikeZone
                            pitches={pitchDots}
                            mode={viewMode}
                            showZoneStats={viewMode === 'dots'}
                          />
                        </motion.div>
                      </AnimatePresence>

                      {/* Pitch type legend */}
                      {viewMode !== 'heat' && pitchDots.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                          {[...new Set(pitchDots.map((p) => p.type))].map((t) => (
                            <div key={t} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: PITCH_COLORS[t] ?? '#94a3b8' }} />
                              <span className="text-xs" style={{ color: '#6b7a99' }}>{t}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right stats column */}
                    <div className="lg:col-span-2 flex flex-col gap-4">

                      {/* Zone breakdown */}
                      <div className="rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                        <ZoneBreakdown pitches={pitchDots} />
                        {pitchDots.length === 0 && (
                          <p className="text-sm text-center py-4" style={{ color: '#3a4460' }}>
                            No pitch location data for the selected filters.
                          </p>
                        )}
                      </div>

                      {/* Type + result breakdown side by side */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                          <TypeBreakdown pitches={pitchDots} />
                          {pitchDots.length === 0 && (
                            <p className="text-xs text-center py-2" style={{ color: '#3a4460' }}>No data</p>
                          )}
                        </div>
                        <div className="rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                          <ResultBreakdown pitches={pitchDots} />
                          {pitchDots.length === 0 && (
                            <p className="text-xs text-center py-2" style={{ color: '#3a4460' }}>No data</p>
                          )}
                        </div>
                      </div>

                      {/* Velocity by zone heatmap table */}
                      {pitchDots.some((p) => p.velocity) && (
                        <div className="rounded-xl p-5" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
                            {strike_zone.page.veloByZoneLabel}
                          </p>
                          <VeloByZone pitches={pitchDots} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Velocity by zone ─────────────────────────────────────────────────────────

function VeloByZone({ pitches }: { pitches: PitchDot[] }) {
  // 3×3 grid of avg velocity
  const zones: { sum: number; count: number }[] = Array.from({ length: 9 }, () => ({ sum: 0, count: 0 }));

  for (const p of pitches) {
    if (!p.velocity) continue;
    const col = p.x < -1 / 3 ? 0 : p.x < 1 / 3 ? 1 : 2;
    const row = p.y < 1 / 3 ? 2 : p.y < 2 / 3 ? 1 : 0;
    const idx = row * 3 + col;
    zones[idx].sum += p.velocity;
    zones[idx].count++;
  }

  const avgs = zones.map((z) => (z.count ? z.sum / z.count : null));
  const validAvgs = avgs.filter((v): v is number => v !== null);
  const minAvg = validAvgs.length ? Math.min(...validAvgs) : 0;
  const maxAvg = validAvgs.length ? Math.max(...validAvgs) : 1;

  const zoneLabels = ['Up & In', 'Up', 'Up & Out', 'Mid In', 'Middle', 'Mid Out', 'Low In', 'Low', 'Low Out'];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {avgs.map((avg, i) => {
        const t = avg !== null && maxAvg > minAvg ? (avg - minAvg) / (maxAvg - minAvg) : 0;
        return (
          <div
            key={i}
            className="rounded p-2 text-center"
            style={{
              background: avg !== null
                ? `rgba(29,140,248,${0.05 + t * 0.25})`
                : '#0a0d14',
              border: '1px solid #1a2240',
            }}
          >
            <p className="text-xs font-black" style={{ fontFamily: 'var(--font-heading)', color: avg !== null ? '#1d8cf8' : '#3a4460' }}>
              {avg !== null ? `${avg.toFixed(1)}` : '—'}
            </p>
            {avg !== null && <p style={{ color: '#6b7a99', fontSize: 8 }}>mph</p>}
            <p style={{ color: '#3a4460', fontSize: 8 }}>{zoneLabels[i]}</p>
          </div>
        );
      })}
    </div>
  );
}
