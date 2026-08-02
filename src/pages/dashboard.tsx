// Dashboard page — moved from src/pages/dashboard/index.tsx
// to avoid the src/pages/dashboard/ subdirectory triggering
// false-positive SEO checks on component shim files.

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Plus, ChevronDown, Loader2, Activity, Zap, RotateCcw, CheckCircle2, XCircle, Minus, List } from 'lucide-react';
import StrikeZone, { PITCH_COLORS } from '@/components/dashboard/StrikeZone';
import type { PitchDot } from '@/components/dashboard/StrikeZone';
import VelocityChart from '@/components/dashboard/VelocityChart';
import { dashboard } from 'virtual:content';
// components moved to src/components/dashboard/

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player { id: number; name: string; position: string; team: string | null; throws: string }
interface PitchSession {
  id: number; playerId: number; label: string | null; sessionDate: string;
  totalPitches: number; strikes: number; balls: number;
  avgVelocity: number | null; maxVelocity: number | null; notes: string | null;
}
interface Pitch {
  id: number; sessionId: number; pitchType: string; velocity: number | null;
  spinRate: number | null; locationX: number | null; locationY: number | null;
  result: string; count: string; pitchNumber: number;
}

const INPUT_STYLE: CSSProperties = { background: '#0a0d14', border: '1px solid #1a2240', color: '#e8eaf0', fontFamily: 'var(--font-sans)' };

const PITCH_TYPES = ['Fastball', 'Curveball', 'Slider', 'Changeup', 'Cutter', 'Sinker', 'Splitter', 'Other'];
const RESULTS = [
  { value: 'strike', label: 'Strike', icon: CheckCircle2, color: '#22c55e' },
  { value: 'ball', label: 'Ball', icon: XCircle, color: '#ef4444' },
  { value: 'foul', label: 'Foul', icon: Minus, color: '#f59e0b' },
  { value: 'swinging_strike', label: 'Swing & Miss', icon: RotateCcw, color: '#a855f7' },
  { value: 'hit', label: 'Hit', icon: Activity, color: '#f97316' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── New Session Modal ────────────────────────────────────────────────────────

function NewSessionModal({
  players,
  onClose,
  onCreated,
}: {
  players: Player[];
  onClose: () => void;
  onCreated: (session: PitchSession, playerId: number) => void;
}) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? 0);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerId) { setError('Select a player.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${playerId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label, notes }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      const session = await res.json();
      onCreated(session, playerId);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full px-3 py-2.5 rounded text-sm outline-none transition-all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' as const }}
        className="w-full max-w-md rounded-lg overflow-hidden"
        style={{ background: '#0f1420', border: '1px solid #1a2240' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #1a2240' }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            {dashboard.modal.title}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="px-4 py-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>Player</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(Number(e.target.value))}
              className={inputCls}
              style={INPUT_STYLE}
            >
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.team ? ` — ${p.team}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>{dashboard.modal.sessionLabelField}</label>
            <input
              type="text"
              placeholder={dashboard.modal.sessionLabelPlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>{dashboard.modal.notesField}</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} resize-none`}
              style={INPUT_STYLE}
              placeholder={dashboard.modal.notesPlaceholder}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}>
              {dashboard.modal.cancelButton}
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#1d8cf8', color: '#fff' }}>
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? dashboard.modal.submitLoading : dashboard.modal.submitIdle}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Pitch Logger Panel ───────────────────────────────────────────────────────

function PitchLogger({
  sessionId,
  onPitchLogged,
}: {
  sessionId: number;
  onPitchLogged: (pitch: Pitch) => void;
}) {
  const [pitchType, setPitchType] = useState('Fastball');
  const [velocity, setVelocity] = useState('');
  const [spinRate, setSpinRate] = useState('');
  const [result, setResult] = useState('strike');
  const [locationX, setLocationX] = useState(0);
  const [locationY, setLocationY] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [lastPitch, setLastPitch] = useState<Pitch | null>(null);

  function handleZoneClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const zoneLeft = 0.2, zoneRight = 0.8, zoneTop = 0.15, zoneBottom = 0.70;
    const x = ((relX - zoneLeft) / (zoneRight - zoneLeft)) * 2 - 1;
    const y = 1 - (relY - zoneTop) / (zoneBottom - zoneTop);
    setLocationX(Math.max(-1.5, Math.min(1.5, x)));
    setLocationY(Math.max(-0.3, Math.min(1.3, y)));
  }

  async function logPitch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pitches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pitchType,
          velocity: velocity ? Number(velocity) : null,
          spinRate: spinRate ? Number(spinRate) : null,
          locationX,
          locationY,
          result,
        }),
      });
      if (!res.ok) return;
      const { pitch } = await res.json();
      setLastPitch(pitch);
      onPitchLogged(pitch);
      setLocationX(0);
      setLocationY(0.5);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {lastPitch && (
          <motion.div
            key={lastPitch.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="px-3 py-2 rounded text-xs flex items-center gap-2"
            style={{ background: 'rgba(29,140,248,0.1)', border: '1px solid rgba(29,140,248,0.2)', color: '#1d8cf8' }}
          >
            <CheckCircle2 size={12} />
            <span>Pitch #{lastPitch.pitchNumber} logged —</span>
            <span style={{ color: PITCH_COLORS[lastPitch.pitchType] ?? '#94a3b8' }}>{lastPitch.pitchType}</span>
            {lastPitch.velocity ? <span> · {lastPitch.velocity} mph</span> : null}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>Pitch Type</p>
        <div className="flex flex-wrap gap-1.5">
          {PITCH_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setPitchType(t)}
              className="px-2.5 py-1 rounded text-xs font-semibold transition-all"
              style={{
                background: pitchType === t ? PITCH_COLORS[t] ?? '#1d8cf8' : 'rgba(26,34,64,0.6)',
                color: pitchType === t ? '#fff' : '#6b7a99',
                border: `1px solid ${pitchType === t ? 'transparent' : '#1a2240'}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7a99' }}>Result</p>
        <div className="grid grid-cols-3 gap-1.5">
          {RESULTS.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => setResult(value)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold transition-all"
              style={{
                background: result === value ? `${color}22` : 'rgba(26,34,64,0.4)',
                color: result === value ? color : '#6b7a99',
                border: `1px solid ${result === value ? `${color}55` : '#1a2240'}`,
              }}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>Velocity (mph)</label>
          <input
            type="number"
            placeholder="e.g. 92"
            value={velocity}
            onChange={(e) => setVelocity(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={INPUT_STYLE}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>Spin Rate (rpm)</label>
          <input
            type="number"
            placeholder="e.g. 2400"
            value={spinRate}
            onChange={(e) => setSpinRate(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={INPUT_STYLE}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7a99' }}>
          Location
          <span className="ml-1 font-normal normal-case tracking-normal" style={{ color: '#3a4460' }}>— click zone to place</span>
        </p>
        <div className="rounded overflow-hidden cursor-crosshair" style={{ background: '#0a0d14', border: '1px solid #1a2240' }}>
          <svg viewBox="0 0 280 320" width="100%" style={{ display: 'block' }} onClick={handleZoneClick}>
            <rect x={56} y={48} width={168} height={176} rx={4} fill="rgba(26,34,64,0.4)" stroke="#1a2240" strokeWidth={1} />
            <rect x={56} y={48} width={168} height={176} rx={2} fill="none" stroke="rgba(29,140,248,0.4)" strokeWidth={1.5} />
            {[1/3, 2/3].map((t) => (
              <g key={t}>
                <line x1={56} y1={48 + t * 176} x2={224} y2={48 + t * 176} stroke="#1a2240" strokeWidth={0.8} strokeDasharray="3 3" />
                <line x1={56 + t * 168} y1={48} x2={56 + t * 168} y2={224} stroke="#1a2240" strokeWidth={0.8} strokeDasharray="3 3" />
              </g>
            ))}
            {(() => {
              const px = 56 + ((locationX + 1) / 2) * 168;
              const py = 48 + (1 - locationY) * 176;
              return (
                <g>
                  <line x1={px - 8} y1={py} x2={px + 8} y2={py} stroke="#1d8cf8" strokeWidth={1.5} />
                  <line x1={px} y1={py - 8} x2={px} y2={py + 8} stroke="#1d8cf8" strokeWidth={1.5} />
                  <circle cx={px} cy={py} r={4} fill="#1d8cf8" opacity={0.8} />
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      <button
        onClick={logPitch}
        disabled={loading}
        className="w-full py-3 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        style={{
          background: '#1d8cf8',
          color: '#fff',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.04em',
          boxShadow: '0 0 20px rgba(29,140,248,0.25)',
        }}
        onMouseEnter={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = '#3a9ef9')}
        onMouseLeave={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = '#1d8cf8')}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
        {loading ? 'Logging…' : 'Log Pitch'}
      </button>
    </div>
  );
}

// ─── Session Stats Bar ────────────────────────────────────────────────────────

function SessionStats({ session }: { session: PitchSession }) {
  const stats = [
    { label: 'Pitches', value: session.totalPitches },
    { label: 'Strike%', value: pct(session.strikes, session.totalPitches), color: '#22c55e' },
    { label: 'Ball%', value: pct(session.balls, session.totalPitches), color: '#ef4444' },
    { label: 'Avg Velo', value: session.avgVelocity ? `${session.avgVelocity.toFixed(1)}` : '—', unit: 'mph', color: '#1d8cf8' },
    { label: 'Max Velo', value: session.maxVelocity ? `${session.maxVelocity.toFixed(1)}` : '—', unit: 'mph', color: '#1d8cf8' },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map(({ label, value, unit, color }) => (
        <div key={label} className="rounded-lg p-3 text-center" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
          <p className="text-xs mb-1" style={{ color: '#6b7a99' }}>{label}</p>
          <p className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: color ?? '#e8eaf0' }}>
            {value}
            {unit && value !== '—' && <span className="text-xs font-normal ml-0.5" style={{ color: '#6b7a99' }}>{unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Pitch Type Breakdown ─────────────────────────────────────────────────────

function PitchBreakdown({ pitches }: { pitches: Pitch[] }) {
  const counts: Record<string, number> = {};
  for (const p of pitches) counts[p.pitchType] = (counts[p.pitchType] ?? 0) + 1;
  const total = pitches.length;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(([type, n]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="text-xs w-20 flex-shrink-0" style={{ color: '#6b7a99' }}>{type}</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1a2240', height: 6 }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: PITCH_COLORS[type] ?? '#94a3b8' }}
              initial={{ width: 0 }}
              animate={{ width: `${(n / total) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' as const }}
            />
          </div>
          <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: '#e8eaf0' }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isPending } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<PitchSession[]>([]);
  const [activeSession, setActiveSession] = useState<PitchSession | null>(null);
  const [activePitches, setActivePitches] = useState<Pitch[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [view, setView] = useState<'live' | 'history'>('live');

  useEffect(() => {
    if (isPending) return;
    fetch('/api/players', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setPlayers(Array.isArray(d) ? d : []); setLoadingPlayers(false); })
      .catch(() => setLoadingPlayers(false));
  }, [isPending]);

  const loadSessions = useCallback(async (playerId: number) => {
    setLoadingSessions(true);
    try {
      const r = await fetch(`/api/players/${playerId}/sessions`, { credentials: 'include' });
      const d = await r.json();
      setSessions(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
    finally { setLoadingSessions(false); }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) loadSessions(selectedPlayerId);
    else setSessions([]);
  }, [selectedPlayerId, loadSessions]);

  useEffect(() => {
    if (!activeSession) { setActivePitches([]); return; }
    fetch(`/api/sessions/${activeSession.id}/pitches`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setActivePitches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [activeSession?.id]);

  function handleSessionCreated(session: PitchSession, playerId: number) {
    setShowNewSession(false);
    setSelectedPlayerId(playerId);
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setActivePitches([]);
    setView('live');
  }

  function handlePitchLogged(pitch: Pitch) {
    setActivePitches((prev) => [...prev, pitch]);
    if (activeSession) {
      fetch(`/api/sessions/${activeSession.id}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => { if (d.session) setActiveSession(d.session); })
        .catch(() => {});
    }
  }

  const pitchDots: PitchDot[] = activePitches
    .filter((p) => p.locationX !== null && p.locationY !== null)
    .map((p) => ({
      id: p.pitchNumber,
      x: p.locationX!,
      y: p.locationY!,
      type: p.pitchType,
      result: p.result,
      velocity: p.velocity,
    }));

  const veloPoints = activePitches
    .filter((p) => p.velocity !== null)
    .map((p) => ({ pitchNumber: p.pitchNumber, velocity: p.velocity!, type: p.pitchType }));

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0d14' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d8cf8' }} />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{dashboard.meta.title}</title>
        <meta name="description" content={dashboard.meta.description} />
        <link rel="canonical" href="https://pitcherml.com/dashboard" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0a0d14' }}>
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: '#0f1420', borderBottom: '1px solid #1a2240' }}
        >
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
              Pitcher<span style={{ color: '#1d8cf8' }}>ML</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1" aria-label="Dashboard navigation">
              {[
                { to: '/dashboard', label: dashboard.nav.dashboard, active: true },
                { to: '/players', label: dashboard.nav.players, active: false },
                { to: '/strike-zone', label: dashboard.nav.strikeZone, active: false },
                { to: '/pitch-analysis', label: dashboard.nav.videoAnalysis, active: false },
              ].map(({ to, label, active }) => (
                <Link
                  key={to}
                  to={to}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                  style={{
                    background: active ? 'rgba(29,140,248,0.12)' : 'transparent',
                    color: active ? '#1d8cf8' : '#6b7a99',
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewSession(true)}
              disabled={players.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: '#1d8cf8', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#3a9ef9'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#1d8cf8'}
            >
              <Plus size={13} />
              {dashboard.sidebar.newSessionButton}
            </button>
            {user && <span className="text-xs hidden sm:block" style={{ color: '#6b7a99' }}>{user.name || user.email}</span>}
            <button
              onClick={async () => { await signOut(); window.location.href = '/login'; }}
              className="text-xs px-2.5 py-1.5 rounded transition-all"
              style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8'; (e.currentTarget as HTMLElement).style.color = '#e8eaf0'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a2240'; (e.currentTarget as HTMLElement).style.color = '#6b7a99'; }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid #1a2240' }}>
            <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid #1a2240' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7a99' }}>{dashboard.sidebar.playerLabel}</p>
              {loadingPlayers ? (
                <div className="flex items-center gap-2 py-1"><Loader2 size={12} className="animate-spin" style={{ color: '#1d8cf8' }} /><span className="text-xs" style={{ color: '#6b7a99' }}>Loading…</span></div>
              ) : players.length === 0 ? (
                <div>
                  <p className="text-xs mb-2" style={{ color: '#6b7a99' }}>{dashboard.sidebar.noPlayersText}</p>
                  <Link to="/players" className="text-xs font-semibold" style={{ color: '#1d8cf8' }}>{dashboard.sidebar.addPlayerLink}</Link>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedPlayerId ?? ''}
                    onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 rounded text-sm outline-none appearance-none pr-8"
                    style={{ background: '#0a0d14', border: '1px solid #1a2240', color: '#e8eaf0', fontFamily: 'var(--font-sans)' }}
                  >
                    <option value="">Select player…</option>
                    {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b7a99' }} />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {!selectedPlayerId ? (
                <p className="text-xs text-center mt-8" style={{ color: '#3a4460' }}>Select a player to see sessions</p>
              ) : loadingSessions ? (
                <div className="flex justify-center mt-8"><Loader2 size={16} className="animate-spin" style={{ color: '#1d8cf8' }} /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center mt-8">
                  <p className="text-xs mb-3" style={{ color: '#3a4460' }}>No sessions yet</p>
                  <button
                    onClick={() => setShowNewSession(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded"
                    style={{ background: 'rgba(29,140,248,0.1)', color: '#1d8cf8', border: '1px solid rgba(29,140,248,0.2)' }}
                  >
                    + New Session
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setActiveSession(s); setView('live'); }}
                      className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                      style={{
                        background: activeSession?.id === s.id ? 'rgba(29,140,248,0.1)' : 'transparent',
                        border: `1px solid ${activeSession?.id === s.id ? 'rgba(29,140,248,0.3)' : 'transparent'}`,
                      }}
                    >
                      <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf0' }}>
                        {s.label || fmtDate(s.sessionDate)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#6b7a99' }}>
                        {s.totalPitches} pitches{s.avgVelocity ? ` · ${s.avgVelocity.toFixed(1)} mph avg` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            {!activeSession ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(29,140,248,0.06)', border: '1.5px solid rgba(29,140,248,0.15)' }}>
                  <Activity size={36} style={{ color: 'rgba(29,140,248,0.35)' }} />
                </div>
                <p className="text-xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#3a4460' }}>{dashboard.noSession.title}</p>
                <p className="text-sm mb-6" style={{ color: '#3a4460' }}>{dashboard.noSession.subtitle}</p>
                {players.length > 0 && (
                  <button onClick={() => setShowNewSession(true)} className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>
                    <Plus size={15} />
                    {dashboard.noSession.newSessionButton}
                  </button>
                )}
                {players.length === 0 && !loadingPlayers && (
                  <Link to="/players" className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm" style={{ background: '#1d8cf8', color: '#fff' }}>
                    {dashboard.noSession.addPlayerLink}
                  </Link>
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                      {activeSession.label || fmtDate(activeSession.sessionDate)}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: '#6b7a99' }}>
                      {activeSession.label ? fmtDate(activeSession.sessionDate) : ''}
                      {players.find((p) => p.id === activeSession.playerId)?.name
                        ? ` · ${players.find((p) => p.id === activeSession.playerId)?.name}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex rounded overflow-hidden flex-shrink-0" style={{ border: '1px solid #1a2240' }}>
                    {[
                      { key: 'live', icon: Zap, label: 'Live' },
                      { key: 'history', icon: List, label: 'Log' },
                    ].map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setView(key as 'live' | 'history')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: view === key ? 'rgba(29,140,248,0.15)' : 'transparent',
                          color: view === key ? '#1d8cf8' : '#6b7a99',
                        }}
                      >
                        <Icon size={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <SessionStats session={activeSession} />

                {view === 'live' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>{dashboard.panels.pitchLocationLabel}</p>
                      <StrikeZone pitches={pitchDots} />
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                        {Object.entries(PITCH_COLORS)
                          .filter(([type]) => activePitches.some((p) => p.pitchType === type))
                          .map(([type, color]) => (
                            <div key={type} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className="text-xs" style={{ color: '#6b7a99' }}>{type}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-4">
                      <div className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240', minHeight: 140 }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>{dashboard.panels.velocityByPitchLabel}</p>
                        <VelocityChart pitches={veloPoints} />
                      </div>

                      {activePitches.length > 0 && (
                        <div className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>Pitch Mix</p>
                          <PitchBreakdown pitches={activePitches} />
                        </div>
                      )}

                      <div className="rounded-lg p-4" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>{dashboard.panels.logNextPitchLabel}</p>
                        <PitchLogger sessionId={activeSession.id} onPitchLogged={handlePitchLogged} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden" style={{ background: '#0f1420', border: '1px solid #1a2240' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid #1a2240' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>
                        Pitch Log — {activePitches.length} pitches
                      </p>
                    </div>
                    {activePitches.length === 0 ? (
                      <div className="p-8 text-center"><p className="text-sm" style={{ color: '#3a4460' }}>{dashboard.table.noPitchesText}</p></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #1a2240' }}>
                              {[dashboard.table.colNumber, dashboard.table.colType, dashboard.table.colResult, dashboard.table.colVelocity, dashboard.table.colSpinRate, dashboard.table.colLocation].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...activePitches].reverse().map((p) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid rgba(26,34,64,0.5)' }}>
                                <td className="px-4 py-2.5" style={{ color: '#6b7a99' }}>{p.pitchNumber}</td>
                                <td className="px-4 py-2.5">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PITCH_COLORS[p.pitchType] ?? '#94a3b8' }} />
                                    <span style={{ color: '#e8eaf0' }}>{p.pitchType}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-semibold"
                                    style={{
                                      background: p.result === 'strike' || p.result === 'swinging_strike' ? 'rgba(34,197,94,0.1)' : p.result === 'ball' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                      color: p.result === 'strike' || p.result === 'swinging_strike' ? '#22c55e' : p.result === 'ball' ? '#ef4444' : '#f59e0b',
                                    }}
                                  >
                                    {p.result.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5" style={{ color: p.velocity ? '#1d8cf8' : '#3a4460' }}>
                                  {p.velocity ? `${p.velocity} mph` : '—'}
                                </td>
                                <td className="px-4 py-2.5" style={{ color: p.spinRate ? '#e8eaf0' : '#3a4460' }}>
                                  {p.spinRate ? `${p.spinRate} rpm` : '—'}
                                </td>
                                <td className="px-4 py-2.5" style={{ color: '#6b7a99' }}>
                                  {p.locationX !== null ? `(${p.locationX.toFixed(2)}, ${p.locationY?.toFixed(2)})` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNewSession && (
          <NewSessionModal
            players={players}
            onClose={() => setShowNewSession(false)}
            onCreated={handleSessionCreated}
          />
        )}
      </AnimatePresence>
    </>
  );
}
