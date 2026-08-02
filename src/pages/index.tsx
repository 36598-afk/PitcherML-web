import { useRef, useEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { home } from 'virtual:content';

// ─── Pitch Trajectory Arc ────────────────────────────────────────────────────
function PitchArc() {
  const pathRef = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const timer = setTimeout(() => {
      path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      path.style.strokeDashoffset = '0';
      setDrawn(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <svg
      viewBox="0 0 900 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d="M 50 240 Q 300 60 520 140 T 860 100"
        stroke="#1d8cf8"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        style={{ filter: 'drop-shadow(0 0 6px rgba(29,140,248,0.8))' }}
      />
      {drawn && (
        <motion.circle
          cx={860}
          cy={100}
          r={5}
          fill="#1d8cf8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' as const }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(29,140,248,1))' }}
        />
      )}
      {drawn && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <rect x="820" y="72" width="72" height="20" rx="2" fill="rgba(29,140,248,0.15)" stroke="rgba(29,140,248,0.4)" strokeWidth="1" />
          <text x="856" y="86" textAnchor="middle" fill="#1d8cf8" fontSize="10" fontFamily="monospace" fontWeight="600">PITCH</text>
        </motion.g>
      )}
    </svg>
  );
}

// ─── Strike Zone Heat Map Mock ────────────────────────────────────────────────
const heatData = [
  [0.1, 0.2, 0.4, 0.3, 0.1],
  [0.3, 0.7, 0.9, 0.6, 0.2],
  [0.4, 0.8, 1.0, 0.9, 0.3],
  [0.2, 0.6, 0.8, 0.7, 0.2],
  [0.1, 0.2, 0.3, 0.2, 0.1],
];

function getHeatColor(v: number) {
  if (v >= 0.85) return '#ef4444';
  if (v >= 0.65) return '#f97316';
  if (v >= 0.45) return '#eab308';
  if (v >= 0.25) return '#22c55e';
  return '#1d4ed8';
}

function HeatMap() {
  return (
    <div className="relative">
      <div
        className="relative mx-auto"
        style={{ width: '180px', height: '180px', border: '2px solid rgba(255,255,255,0.25)', borderRadius: '2px' }}
      >
        <div className="grid gap-0.5 p-1 h-full" style={{ gridTemplateRows: 'repeat(5, 1fr)' }}>
          {heatData.map((row, ri) => (
            <div key={ri} className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {row.map((val, ci) => (
                <motion.div
                  key={ci}
                  className="rounded-sm"
                  style={{ background: getHeatColor(val), opacity: val * 0.9 + 0.1 }}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: val * 0.9 + 0.1 }}
                  viewport={{ once: true }}
                  transition={{ delay: (ri * 5 + ci) * 0.02, duration: 0.25, ease: 'easeOut' as const }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute -top-6 left-0 right-0 text-center text-xs font-mono" style={{ color: '#6b7a99', letterSpacing: '0.1em' }}>
          STRIKE ZONE
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-4">
        {[
          { color: '#1d4ed8', label: 'Low' },
          { color: '#22c55e', label: '' },
          { color: '#eab308', label: '' },
          { color: '#f97316', label: '' },
          { color: '#ef4444', label: 'High' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
            {item.label && <span className="text-xs font-mono" style={{ color: '#4a5568' }}>{item.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini Line Chart ──────────────────────────────────────────────────────────
function MiniLineChart() {
  const points = [62, 71, 68, 75, 72, 80, 77, 85, 82, 90, 88, 95];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 200, h = 60;
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - ((p - min) / (max - min)) * h,
  }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '60px' }}>
      <motion.path
        d={d}
        stroke="#1d8cf8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut' as const }}
      />
      <motion.path
        d={`${d} L ${w} ${h} L 0 ${h} Z`}
        fill="url(#lineGrad)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.8 }}
      />
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d8cf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1d8cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const PITCH_DOTS = [
  { x: 45, y: 30, type: 'strike' }, { x: 55, y: 50, type: 'strike' },
  { x: 60, y: 65, type: 'strike' }, { x: 40, y: 55, type: 'ball' },
  { x: 70, y: 40, type: 'ball' },  { x: 50, y: 45, type: 'strike' },
  { x: 48, y: 60, type: 'strike' }, { x: 35, y: 35, type: 'ball' },
  { x: 62, y: 55, type: 'strike' }, { x: 75, y: 70, type: 'ball' },
];

function PitchLocationChart() {
  return (
    <div className="relative mx-auto" style={{ width: '160px', height: '160px' }}>
      <div
        className="absolute"
        style={{
          left: '20%', top: '20%', right: '20%', bottom: '20%',
          border: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '1px',
        }}
      />
      <div className="absolute -top-5 left-0 right-0 text-center text-xs font-mono" style={{ color: '#6b7a99', letterSpacing: '0.1em' }}>
        PITCH LOCATIONS
      </div>
      {PITCH_DOTS.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            transform: 'translate(-50%, -50%)',
            background: dot.type === 'strike' ? '#1d8cf8' : '#ef4444',
            boxShadow: dot.type === 'strike' ? '0 0 6px rgba(29,140,248,0.7)' : '0 0 6px rgba(239,68,68,0.7)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.2, ease: 'easeOut' as const }}
        />
      ))}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-4">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: '#1d8cf8' }} />
          <span className="text-xs font-mono" style={{ color: '#4a5568' }}>Strike</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
          <span className="text-xs font-mono" style={{ color: '#4a5568' }}>Ball</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const site = 'https://pitcherml.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${site}/#website`, name: 'PitcherML', url: `${site}/` },
      {
        '@type': 'SoftwareApplication',
        '@id': `${site}/#organization`,
        name: 'PitcherML',
        url: `${site}/`,
        applicationCategory: 'SportsApplication',
        description: 'Broadcast-grade pitch tracking, strike zone mapping, and heat zone analytics for coaches and players.',
      },
      {
        '@type': 'WebPage',
        '@id': `${site}/#webpage`,
        url: `${site}/`,
        name: 'PitcherML — Broadcast-Grade Pitch Analytics',
        isPartOf: { '@id': `${site}/#website` },
        about: { '@id': `${site}/#organization` },
        datePublished: '2026-07-31',
        dateModified: '2026-07-31',
      },
    ],
  };

  return (
    <>
      <Helmet>
        <title>PitcherML — Broadcast-Grade Pitch Analytics</title>
        <meta name="description" content="Pitch tracking, strike zone location, and heat zone analytics built for coaches and players who demand precision. MLB-grade accuracy." />
        <link rel="canonical" href="https://pitcherml.com/" />
        <meta property="og:title" content="PitcherML — Broadcast-Grade Pitch Analytics" />
        <meta property="og:description" content="Pitch tracking, strike zone location, and heat zone analytics built for coaches and players who demand precision." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://pitcherml.com/" />
        <meta property="og:image" content="https://pitcherml.com/airo-assets/images/pages/home/hero-pitcher" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://pitcherml.com/airo-assets/images/pages/home/hero-pitcher" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          className="relative min-h-screen flex items-center overflow-hidden pt-16"
          style={{ background: '#0a0d14' }}
        >
          {/* Stadium radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,140,248,0.12) 0%, transparent 70%)' }}
          />

          {/* Hero image — right side */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-3/5">
              <img
                src="/airo-assets/images/pages/home/hero-pitcher"
                alt="Baseball pitcher throwing on the mound under stadium lights"
                className="w-full h-full object-cover"
                loading="eager"
                fetchPriority="high"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, #0a0d14 0%, rgba(10,13,20,0.7) 40%, rgba(10,13,20,0.2) 100%)', pointerEvents: 'none' }}
              />
            </div>
          </div>

          {/* Pitch arc animation */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
            <PitchArc />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
            <div className="max-w-2xl">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' as const }}
                className="flex items-center gap-3 mb-6"
              >
                <div className="w-6 h-px" style={{ background: '#1d8cf8' }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#1d8cf8', fontFamily: 'var(--font-sans)', letterSpacing: '0.15em' }}>
                  Pitch Analytics Platform
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' as const }}
                className="leading-none mb-2"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: 'clamp(3.5rem, 8vw, 7rem)',
                  color: '#e8eaf0',
                  letterSpacing: '-0.01em',
                  lineHeight: 0.95,
                }}
              >
                {home.hero.headline}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.18, ease: 'easeOut' as const }}
                className="leading-none mb-8"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: 'clamp(3.5rem, 8vw, 7rem)',
                  color: '#1d8cf8',
                  letterSpacing: '-0.01em',
                  lineHeight: 0.95,
                  textShadow: '0 0 40px rgba(29,140,248,0.4)',
                }}
              >
                {home.hero.headlineAccent}
              </motion.div>

              {/* Subhead */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25, ease: 'easeOut' as const }}
                className="text-base md:text-lg leading-relaxed mb-10 max-w-lg"
                style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}
              >
                {home.hero.subhead}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.32, ease: 'easeOut' as const }}
                className="flex flex-wrap gap-4"
              >
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold transition-all duration-150"
                  style={{
                    background: '#1d8cf8',
                    color: '#ffffff',
                    borderRadius: '3px',
                    fontFamily: 'var(--font-sans)',
                    boxShadow: '0 0 24px rgba(29,140,248,0.35)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#3a9ef9';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(29,140,248,0.55)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#1d8cf8';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(29,140,248,0.35)';
                  }}
                >
                  {home.hero.ctaPrimary}
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold transition-all duration-150"
                  style={{
                    background: 'transparent',
                    color: '#e8eaf0',
                    border: '1px solid #1a2240',
                    borderRadius: '3px',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8';
                    (e.currentTarget as HTMLElement).style.color = '#1d8cf8';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                    (e.currentTarget as HTMLElement).style.color = '#e8eaf0';
                  }}
                >
                  {home.hero.ctaSecondary}
                </a>
              </motion.div>
            </div>
          </div>

          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #0a0d14)' }}
          />
        </section>

        {/* ── FEATURES BENTO ───────────────────────────────────────────── */}
        <section id="features" style={{ background: '#0a0d14', paddingTop: '6rem', paddingBottom: '6rem' }}>
          <div className="max-w-7xl mx-auto px-6">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease: 'easeOut' as const }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-px" style={{ background: '#1d8cf8' }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#1d8cf8', fontFamily: 'var(--font-sans)', letterSpacing: '0.15em' }}>
                  {home.features.eyebrow}
                </span>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                  color: '#e8eaf0',
                  lineHeight: 1.05,
                  maxWidth: '600px',
                }}
              >
                {home.features.headline}
              </h2>
              <p className="mt-4 text-base max-w-xl" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                {home.features.subhead}
              </p>
            </motion.div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1 — Heat Map (large, spans 2 rows on md) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, ease: 'easeOut' as const }}
                className="md:row-span-2 relative overflow-hidden group"
                style={{
                  background: '#0f1420',
                  border: '1px solid #1a2240',
                  borderRadius: '4px',
                  padding: '2rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  minHeight: '340px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(29,140,248,0.4)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(29,140,248,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,140,248,0.06) 0%, transparent 70%)' }} />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#1d8cf8', boxShadow: '0 0 6px rgba(29,140,248,0.8)' }} />
                    <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#1d8cf8', letterSpacing: '0.12em' }}>Live</span>
                  </div>
                  <h3 className="mb-1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.5rem', color: '#e8eaf0' }}>
                    {home.features.cards[0].title}
                  </h3>
                  <p className="text-sm mb-8" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                    {home.features.cards[0].description}
                  </p>
                  <div className="flex-1 flex items-center justify-center pt-4">
                    <HeatMap />
                  </div>
                </div>
              </motion.div>

              {/* Card 2 — Session Trends */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' as const }}
                className="relative overflow-hidden"
                style={{
                  background: '#0f1420',
                  border: '1px solid #1a2240',
                  borderRadius: '4px',
                  padding: '1.75rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(29,140,248,0.4)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(29,140,248,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,140,248,0.05) 0%, transparent 70%)' }} />
                <div className="relative z-10">
                  <h3 className="mb-1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: '#e8eaf0' }}>
                    {home.features.cards[1].title}
                  </h3>
                  <p className="text-sm mb-5" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                    {home.features.cards[1].description}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono" style={{ color: '#4a5568' }}>Pitch count — last 12 sessions</span>
                    <span className="text-xs font-mono" style={{ color: '#22c55e' }}>↑ Trending up</span>
                  </div>
                  <MiniLineChart />
                  <div className="flex justify-between mt-1">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m) => (
                      <span key={m} className="text-xs font-mono" style={{ color: '#2d3748' }}>{m}</span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Card 3 — Pitch Location */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' as const }}
                className="relative overflow-hidden"
                style={{
                  background: '#0f1420',
                  border: '1px solid #1a2240',
                  borderRadius: '4px',
                  padding: '1.75rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(29,140,248,0.4)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(29,140,248,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,140,248,0.05) 0%, transparent 70%)' }} />
                <div className="relative z-10">
                  <h3 className="mb-1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: '#e8eaf0' }}>
                    {home.features.cards[2].title}
                  </h3>
                  <p className="text-sm mb-8" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                    {home.features.cards[2].description}
                  </p>
                  <PitchLocationChart />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section id="how-it-works" style={{ background: '#070a10', borderTop: '1px solid #1a2240', paddingTop: '6rem', paddingBottom: '6rem' }}>
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease: 'easeOut' as const }}
              className="mb-16"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-px" style={{ background: '#1d8cf8' }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#1d8cf8', fontFamily: 'var(--font-sans)', letterSpacing: '0.15em' }}>
                  {home.howItWorks.eyebrow}
                </span>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  color: '#e8eaf0',
                  lineHeight: 1.05,
                }}
              >
                {home.howItWorks.headline}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {home.howItWorks.steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.08, ease: 'easeOut' as const }}
                  className="relative"
                  style={{
                    borderLeft: i === 0 ? '2px solid #1d8cf8' : '2px solid #1a2240',
                    paddingLeft: '2rem',
                    paddingBottom: '2rem',
                    paddingTop: '0.5rem',
                  }}
                >
                  <div
                    className="text-6xl font-bold mb-4 leading-none"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: i === 0 ? '#1d8cf8' : '#1a2240',
                      textShadow: i === 0 ? '0 0 20px rgba(29,140,248,0.3)' : 'none',
                    }}
                  >
                    {step.number}
                  </div>
                  <h3 className="mb-3" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.35rem', color: '#e8eaf0' }}>
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section style={{ background: '#0a0d14', borderTop: '1px solid #1a2240', paddingTop: '6rem', paddingBottom: '6rem' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div
              className="relative overflow-hidden"
              style={{
                background: '#0f1420',
                border: '1px solid #1a2240',
                borderRadius: '4px',
                padding: 'clamp(2.5rem, 5vw, 4rem)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 80% at 20% 50%, rgba(29,140,248,0.08) 0%, transparent 60%)' }} />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-10">
                <div className="max-w-xl">
                  <h2
                    className="leading-none mb-4"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: 'clamp(3rem, 6vw, 5.5rem)',
                      color: '#e8eaf0',
                      lineHeight: 0.95,
                    }}
                  >
                    <span>{home.cta.headline}</span>
                    <br />
                    <span style={{ color: '#1d8cf8', textShadow: '0 0 40px rgba(29,140,248,0.4)' }}>
                      {home.cta.headlineAccent}
                    </span>
                  </h2>
                  <p className="text-base" style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}>
                    {home.cta.subhead}
                  </p>
                </div>
                <div className="flex flex-col gap-4 shrink-0">
                  <a
                    href="#"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold transition-all duration-150"
                    style={{
                      background: '#1d8cf8',
                      color: '#ffffff',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-sans)',
                      boxShadow: '0 0 24px rgba(29,140,248,0.35)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#3a9ef9';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(29,140,248,0.55)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#1d8cf8';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(29,140,248,0.35)';
                    }}
                  >
                    {home.cta.ctaPrimary}
                  </a>
                  <a
                    href="#"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold transition-all duration-150"
                    style={{
                      background: 'transparent',
                      color: '#e8eaf0',
                      border: '1px solid #1a2240',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8';
                      (e.currentTarget as HTMLElement).style.color = '#1d8cf8';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                      (e.currentTarget as HTMLElement).style.color = '#e8eaf0';
                    }}
                  >
                    {home.cta.ctaSecondary}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
