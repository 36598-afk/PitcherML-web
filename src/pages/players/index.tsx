import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Plus, User, ChevronRight, X, Loader2, TrendingUp, Calendar, Target } from 'lucide-react';
import { players as playersContent } from 'virtual:content';

const INPUT_STYLE: CSSProperties = { background: '#0a0d14', border: '1px solid #1a2240', color: '#e8eaf0', fontFamily: 'var(--font-sans)' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  position: string;
  team: string | null;
  throws: string;
  age: number | null;
  createdAt: string;
}

interface PlayerDetail {
  player: Player;
  sessions: Session[];
  careerStats: {
    totalSessions: number;
    totalPitches: number;
    avgVelocity: string | null;
    maxVelocity: string | null;
  };
}

interface Session {
  id: number;
  sessionDate: string;
  label: string | null;
  totalPitches: number;
  strikes: number;
  balls: number;
  avgVelocity: number | null;
  maxVelocity: number | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function strikeRate(strikes: number, total: number) {
  if (!total) return '—';
  return `${Math.round((strikes / total) * 100)}%`;
}

// ─── Add Player Modal ─────────────────────────────────────────────────────────

function AddPlayerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Player) => void }) {
  const [form, setForm] = useState({ name: '', position: 'Pitcher', team: '', throws: 'R', age: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to create player.'); return; }
      const player = await res.json();
      onCreated(player);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const fields: { id: keyof typeof form; label: string; type?: string; options?: string[] }[] = [
    { id: 'name', label: 'Full Name *' },
    { id: 'position', label: 'Position', options: ['Pitcher', 'Catcher', 'Infield', 'Outfield', 'DH'] },
    { id: 'team', label: 'Team' },
    { id: 'throws', label: 'Throws', options: ['R', 'L', 'S'] },
    { id: 'age', label: 'Age', type: 'number' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' as const }}
        className="w-full max-w-lg rounded-lg overflow-hidden"
        style={{ background: '#0f1420', border: '1px solid #1a2240' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1a2240' }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
            Add Player
          </h2>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: '#6b7a99' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e8eaf0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7a99')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(({ id, label, type, options }) => (
              <div key={id} className={id === 'name' ? 'md:col-span-2' : ''}>
                <label htmlFor={id} className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7a99' }}>
                  {label}
                </label>
                {options ? (
                  <select
                    id={id}
                    value={form[id]}
                    onChange={(e) => set(id, e.target.value)}
                    className="w-full px-3 py-2.5 rounded text-sm outline-none"
                    style={INPUT_STYLE}
                  >
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={type || 'text'}
                    value={form[id]}
                    onChange={(e) => set(id, e.target.value)}
                    className="w-full px-3 py-2.5 rounded text-sm outline-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded text-sm font-semibold transition-all"
              style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8'; (e.currentTarget as HTMLElement).style.color = '#e8eaf0'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a2240'; (e.currentTarget as HTMLElement).style.color = '#6b7a99'; }}
            >
              {playersContent.modal.cancelButton}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#1d8cf8', color: '#fff', fontFamily: 'var(--font-sans)' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? playersContent.modal.submitLoading : playersContent.modal.submitIdle}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Player Detail Panel ──────────────────────────────────────────────────────

function StartSessionButton({ playerId }: { playerId: number }) {
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/players/${playerId}/sessions/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { session } = await res.json() as { session: { id: number; status: string } };
      // A brand-new session still needs its zone set; a resumed one may
      // already be active, in which case go straight to uploading.
      window.location.href = session.status === 'calibrating'
        ? `/session/${session.id}/calibrate`
        : `/session/${session.id}`;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={starting}
        className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
        style={{
          background: starting ? '#1a2240' : '#1d8cf8',
          color: starting ? '#3a4460' : '#fff',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.04em',
          cursor: starting ? 'not-allowed' : 'pointer',
        }}
      >
        {starting ? 'Starting…' : 'Start Pitching Session'}
      </button>
      {err && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{err}</p>}
    </div>
  );
}

function PlayerDetailPanel({ playerId, onClose }: { playerId: number; onClose: () => void }) {
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/players/${playerId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  const statCard = (label: string, value: string | number | null, unit?: string) => (
    <div
      key={label}
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: '#0a0d14', border: '1px solid #1a2240' }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>{label}</span>
      <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
        {value ?? '—'}
        {value && unit ? <span className="text-sm font-normal ml-1" style={{ color: '#6b7a99' }}>{unit}</span> : null}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.25, ease: 'easeOut' as const }}
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: '#0f1420', borderLeft: '1px solid #1a2240' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: '#0f1420', borderBottom: '1px solid #1a2240' }}>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
          {playersContent.detail.panelTitle}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: '#6b7a99' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#e8eaf0')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7a99')}
        >
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: '#1d8cf8' }} />
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center">
          <p style={{ color: '#6b7a99' }}>Failed to load player.</p>
        </div>
      ) : (
        <div className="p-6 flex flex-col gap-6">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(29,140,248,0.12)', border: '1.5px solid rgba(29,140,248,0.3)' }}
            >
              <User size={28} style={{ color: '#1d8cf8' }} />
            </div>
            <div>
              <h3 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
                {data.player.name}
              </h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  data.player.position,
                  data.player.team,
                  data.player.throws ? `Throws ${data.player.throws}` : null,
                  data.player.age ? `Age ${data.player.age}` : null,
                ].filter(Boolean).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: 'rgba(29,140,248,0.1)', color: '#1d8cf8', border: '1px solid rgba(29,140,248,0.2)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Start a session — the only way into pitch analysis, so every
              pitch is guaranteed to belong to a specific player */}
          <StartSessionButton playerId={playerId} />

          {/* Career stats */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7a99' }}>
              {playersContent.detail.careerStatsHeading}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {statCard(playersContent.detail.statSessions, data.careerStats.totalSessions)}
              {statCard(playersContent.detail.statTotalPitches, data.careerStats.totalPitches)}
              {statCard(playersContent.detail.statAvgVelocity, data.careerStats.avgVelocity ? Number(data.careerStats.avgVelocity).toFixed(1) : null, 'mph')}
              {statCard(playersContent.detail.statMaxVelocity, data.careerStats.maxVelocity ? Number(data.careerStats.maxVelocity).toFixed(1) : null, 'mph')}
            </div>
          </div>

          {/* Session history */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} style={{ color: '#1d8cf8' }} />
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>
                Session History
              </h4>
            </div>

            {data.sessions.length === 0 ? (
              <div
                className="rounded-lg p-6 text-center"
                style={{ background: '#0a0d14', border: '1px dashed #1a2240' }}
              >
                <Target size={24} className="mx-auto mb-2" style={{ color: '#1a2240' }} />
                <p className="text-sm" style={{ color: '#6b7a99' }}>{playersContent.detail.noSessionsTitle}</p>
                <p className="text-xs mt-1" style={{ color: '#3a4460' }}>{playersContent.detail.noSessionsSubtitle}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg p-4"
                    style={{ background: '#0a0d14', border: '1px solid #1a2240' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                          {s.label || formatDate(s.sessionDate)}
                        </p>
                        {s.label && (
                          <p className="text-xs mt-0.5" style={{ color: '#6b7a99' }}>{formatDate(s.sessionDate)}</p>
                        )}
                      </div>
                      <div className="flex gap-3 text-right flex-shrink-0">
                        <div>
                          <p className="text-xs" style={{ color: '#6b7a99' }}>{playersContent.detail.statPitches}</p>
                          <p className="text-sm font-bold" style={{ color: '#e8eaf0' }}>{s.totalPitches}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#6b7a99' }}>Strike%</p>
                          <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{strikeRate(s.strikes, s.totalPitches)}</p>
                        </div>
                        {s.avgVelocity && (
                          <div>
                            <p className="text-xs" style={{ color: '#6b7a99' }}>{playersContent.detail.statAvgVelo}</p>
                            <p className="text-sm font-bold" style={{ color: '#1d8cf8' }}>{s.avgVelocity.toFixed(1)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {s.notes && (
                      <p className="mt-2 text-xs" style={{ color: '#6b7a99' }}>{s.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend placeholder */}
          {data.sessions.length > 1 && (
            <div
              className="rounded-lg p-4"
              style={{ background: '#0a0d14', border: '1px solid #1a2240' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} style={{ color: '#1d8cf8' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7a99' }}>
                  {playersContent.detail.velocityTrendHeading}
                </span>
              </div>
              <VelocitySparkline sessions={data.sessions} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Velocity Sparkline ───────────────────────────────────────────────────────

function VelocitySparkline({ sessions }: { sessions: Session[] }) {
  const withVelo = [...sessions].reverse().filter((s) => s.avgVelocity !== null);
  if (withVelo.length < 2) {
    return <p className="text-xs" style={{ color: '#6b7a99' }}>{playersContent.detail.notEnoughVeloData}</p>;
  }

  const values = withVelo.map((s) => s.avgVelocity as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300;
  const h = 60;

  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 8) - 4,
  }));

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const fill = `${d} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '60px' }}>
      <defs>
        <linearGradient id="veloGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d8cf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1d8cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fill}
        fill="url(#veloGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      />
      <motion.path
        d={d}
        stroke="#1d8cf8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' as const }}
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#1d8cf8" />
      ))}
    </svg>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, selected, onClick }: { player: Player; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left rounded-lg p-4 transition-all duration-150 flex items-center gap-4"
      style={{
        background: selected ? 'rgba(29,140,248,0.08)' : '#0f1420',
        border: selected ? '1px solid rgba(29,140,248,0.4)' : '1px solid #1a2240',
        cursor: 'pointer',
      }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.998 }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: selected ? 'rgba(29,140,248,0.2)' : 'rgba(29,140,248,0.08)',
          border: `1.5px solid ${selected ? 'rgba(29,140,248,0.5)' : 'rgba(29,140,248,0.2)'}`,
        }}
      >
        <User size={18} style={{ color: '#1d8cf8' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}>
          {player.name}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7a99' }}>
          {[player.position, player.team, player.throws ? `Throws ${player.throws}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      <ChevronRight size={16} style={{ color: selected ? '#1d8cf8' : '#3a4460', flexShrink: 0 }} />
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { user, isPending } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isPending) return;
    fetch('/api/players', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { setPlayers(Array.isArray(data) ? data : []); setLoadingPlayers(false); })
      .catch(() => setLoadingPlayers(false));
  }, [isPending]);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.team || '').toLowerCase().includes(search.toLowerCase())
  );

  function handlePlayerCreated(p: Player) {
    setPlayers((prev) => [p, ...prev]);
    setShowAddModal(false);
    setSelectedId(p.id);
  }

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
        <title>{playersContent.meta.title}</title>
        <meta name="description" content={playersContent.meta.description} />
        <link rel="canonical" href="https://pitcherml.com/players" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex flex-col h-screen" style={{ background: '#0a0d14' }}>
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ background: '#0f1420', borderBottom: '1px solid #1a2240' }}
        >
          <Link
            to="/"
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}
          >
            Pitcher<span style={{ color: '#1d8cf8' }}>ML</span>
          </Link>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm hidden sm:block" style={{ color: '#6b7a99' }}>
                {user.name || user.email}
              </span>
            )}
            <button
              onClick={async () => { await signOut(); window.location.href = '/login'; }}
              className="text-sm px-3 py-1.5 rounded transition-all"
              style={{ background: 'transparent', border: '1px solid #1a2240', color: '#6b7a99', fontFamily: 'var(--font-sans)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8'; (e.currentTarget as HTMLElement).style.color = '#e8eaf0'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a2240'; (e.currentTarget as HTMLElement).style.color = '#6b7a99'; }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — player list */}
          <div
            className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid #1a2240' }}
          >
            {/* Sidebar header */}
            <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1a2240' }}>
              <div className="flex items-center justify-between mb-3">
                <h1
                  className="text-lg font-black"
                  style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}
                >
                  {playersContent.pageTitle}
                </h1>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={{ background: '#1d8cf8', color: '#fff', fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#3a9ef9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1d8cf8')}
                >
                  <Plus size={13} />
                  {playersContent.addButton}
                </button>
              </div>

              {/* Search */}
              <input
                type="search"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{
                  background: '#0a0d14',
                  border: '1px solid #1a2240',
                  color: '#e8eaf0',
                  fontFamily: 'var(--font-sans)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
              />
            </div>

            {/* Player list */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {loadingPlayers ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin" style={{ color: '#1d8cf8' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'rgba(29,140,248,0.08)', border: '1.5px solid rgba(29,140,248,0.2)' }}
                  >
                    <User size={24} style={{ color: '#1d8cf8' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#e8eaf0' }}>
                    {search ? playersContent.emptySearchTitle : playersContent.emptyTitle}
                  </p>
                  <p className="text-xs" style={{ color: '#6b7a99' }}>
                    {search ? playersContent.emptySearchSubtitle : playersContent.emptySubtitle}
                  </p>
                  {!search && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-all"
                      style={{ background: 'rgba(29,140,248,0.1)', color: '#1d8cf8', border: '1px solid rgba(29,140,248,0.2)' }}
                    >
                      <Plus size={14} />
                      {playersContent.addButton}
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    selected={selectedId === p.id}
                    onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedId ? (
                <PlayerDetailPanel
                  key={selectedId}
                  playerId={selectedId}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-8"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                    style={{ background: 'rgba(29,140,248,0.06)', border: '1.5px solid rgba(29,140,248,0.15)' }}
                  >
                    <User size={36} style={{ color: 'rgba(29,140,248,0.4)' }} />
                  </div>
                  <p className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#3a4460' }}>
                    {playersContent.selectPromptTitle}
                  </p>
                  <p className="text-sm" style={{ color: '#3a4460' }}>
                    {playersContent.selectPromptSubtitle}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddPlayerModal onClose={() => setShowAddModal(false)} onCreated={handlePlayerCreated} />
        )}
      </AnimatePresence>
    </>
  );
}
