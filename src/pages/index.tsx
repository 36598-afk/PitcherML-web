import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useSession } from '@/lib/auth/auth-client';
import { motion } from 'motion/react';
import {
  Loader2, Target, Activity, Grid3x3, Pencil, Film, Crosshair,
  ArrowRight,
} from 'lucide-react';
import Header from '@/layouts/parts/Header';
import Footer from '@/layouts/parts/Footer';
import Silk from '@/components/brand/Silk';

/**
 * The entire site is sign-in -> tool, so this decides which of those two
 * an authenticated visitor lands on. An UNAUTHENTICATED visitor gets an
 * actual landing page instead of an immediate bounce to /login -- this
 * is that page's content.
 */
export default function RootPage() {
  const { isAuthenticated, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0d14' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d8cf8' }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/players" replace />;
  }

  return <Landing />;
}

/** True only after the component has mounted in the browser. This page is
 *  server-rendered, and `motion` components inject animation styles (e.g.
 *  opacity: 0 before a fade-in) that exist client-side but not in the
 *  server-rendered markup -- React sees the mismatch on hydration and
 *  throws (minified error #418). Gating all animation behind this flag
 *  means the server always renders the plain, fully-visible final state
 *  (nothing to mismatch), and the animation only starts once the page
 *  has actually mounted in the browser. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

// ─── Reveal-on-scroll: more dramatic than a plain fade -- scale + rise ────────

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const mounted = useMounted();
  if (!mounted) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-1.5 rounded-full" style={{ background: '#1d8cf8' }} />
      <span className="text-xs uppercase tracking-[0.14em]" style={{ color: '#6b7a99' }}>{children}</span>
    </div>
  );
}

/** Cheap grain texture, fixed over the whole page, blended so it reads as
 *  subtle film grain rather than visible noise. Pure SVG, deterministic --
 *  no hydration risk, safe to render immediately either way. */
function Grain() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 opacity-[0.04]" style={{ mixBlendMode: 'overlay' }}>
      <svg className="w-full h-full">
        <filter id="pml-grain"><feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#pml-grain)" />
      </svg>
    </div>
  );
}

// ─── Hero: stylized version of the actual ball-trace visual from the report page ──

function HeroTrace() {
  const mounted = useMounted();
  const d = 'M 8,78 C 20,55 34,30 50,18 C 66,6 82,10 92,28';
  return (
    <div className="pml-glass rounded-2xl overflow-hidden relative">
      <svg viewBox="0 0 100 90" width="100%" style={{ display: 'block' }}>
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={90} stroke="#1a2240" strokeWidth={0.4} strokeDasharray="2 2" />
            <line x1={0} y1={v * 0.9} x2={100} y2={v * 0.9} stroke="#1a2240" strokeWidth={0.4} strokeDasharray="2 2" />
          </g>
        ))}
        <path d={d} fill="none" stroke="#dc2626" strokeWidth={3.4} strokeLinecap="round" opacity={0.3} />
        {mounted ? (
          <motion.path
            d={d} fill="none" stroke="#f87171" strokeWidth={0.7} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeOut', delay: 0.5 }}
          />
        ) : (
          <path d={d} fill="none" stroke="#f87171" strokeWidth={0.7} strokeLinecap="round" />
        )}
        <circle cx={8} cy={78} r={1.2} fill="#1d8cf8" />
        <g>
          <circle cx={92} cy={28} r={3.4} fill="#dc2626" opacity={0.3} />
          <circle cx={92} cy={28} r={1.9} fill="#dc2626" stroke="#fff" strokeWidth={0.4} />
          <text x={92} y={22.5} textAnchor="middle" fontSize={3.6} fontWeight={800} fill="#fff"
                stroke="#000" strokeWidth={0.6} paintOrder="stroke">IMPACT</text>
        </g>
      </svg>
      <div className="px-4 py-3 flex items-center gap-2 text-xs relative" style={{ borderTop: '1px solid #1a2240', color: '#6b7a99' }}>
        <Crosshair size={12} style={{ color: '#1d8cf8' }} />
        Every pitch, tracked frame by frame — automatically.
      </div>
    </div>
  );
}

function HeroCopy() {
  const mounted = useMounted();
  const content = (
    <>
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
            style={{ border: '1px solid #1a2240', background: 'rgba(29,140,248,0.06)', color: '#6b7a99' }}>
        <span className="size-1.5 rounded-full" style={{ background: '#1d8cf8' }} />
        Ball tracking + pitch analytics, from a phone video
      </span>
      <h1 className="mt-6 font-black leading-[1.05] tracking-tight"
          style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.2rem,5vw,3.6rem)', color: '#e8eaf0' }}>
        Point a camera.<br />
        <span style={{ color: '#1d8cf8' }}>Get a real pitch report.</span>
      </h1>
      <p className="mt-6 max-w-lg text-base leading-relaxed" style={{ color: '#6b7a99' }}>
        Upload bullpen or game footage and PitcherML tracks the ball automatically —
        flight path, impact point, and strike-zone location for every pitch, with a full
        session report you can review pitch by pitch.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/signup"
              className="pml-btn-pop inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: '#1d8cf8', color: '#fff' }}>
          Get started <ArrowRight size={14} />
        </Link>
        <Link to="/login"
              className="pml-btn-pop inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ border: '1px solid #1a2240', color: '#e8eaf0' }}>
          Log in
        </Link>
      </div>
      <p className="mt-4 text-xs" style={{ color: '#3a4460' }}>
        No special cameras or markers needed. Works with footage you already have.
      </p>
    </>
  );
  if (!mounted) return <div>{content}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {content}
    </motion.div>
  );
}

function HeroVisual() {
  const mounted = useMounted();
  if (!mounted) {
    return <div><HeroTrace /></div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <HeroTrace />
    </motion.div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: '#0a0d14' }}>
      <Grain />
      <Header />

      {/* ===== Hero ===== */}
      <section id="top" className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 opacity-90">
          <Silk speed={0.9} scale={1.4} color="#123a6b" noiseIntensity={1.4} rotation={0.12} />
        </div>
        <div className="pointer-events-none absolute inset-0"
             style={{ background: 'radial-gradient(70% 60% at 50% 10%, rgba(10,13,20,0) 0%, rgba(10,13,20,0.35) 55%, #0a0d14 100%)' }} />
        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <HeroCopy />
          <HeroVisual />
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 w-full">
        <SectionKicker>How it works</SectionKicker>
        <h2 className="mt-4 max-w-md font-black tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', color: '#e8eaf0' }}>
          Three steps. No manual tagging.
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <Step n={1} icon={<Film size={18} />}
                title="Upload your video"
                body="A bullpen session or game clip from any angle-consistent camera — phone footage works fine." />
          <Step n={2} icon={<Activity size={18} />}
                title="We track the ball"
                body="Every pitch gets its flight path detected automatically, frame by frame, down to the impact point." />
          <Step n={3} icon={<Grid3x3 size={18} />}
                title="Get your report"
                body="Strike zone heatmap, pitch locations, and a full breakdown — ready as soon as processing finishes." />
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 w-full">
        <SectionKicker>What you get</SectionKicker>
        <h2 className="mt-4 font-black tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', color: '#e8eaf0' }}>
          Built around the actual pitch, not just the result.
        </h2>
        <div className="mt-10 grid md:grid-cols-2 gap-5">
          <FeatureCard icon={<Crosshair size={18} />} title="Frame-by-frame ball tracking"
                       body="Every detected position of the ball, visualized as a smooth trace synced to your video's own playback — not a rough estimate." />
          <FeatureCard icon={<Target size={18} />} title="Strike zone heatmap"
                       body="See exactly where pitches land relative to a calibrated zone, aggregated across a full session." />
          <FeatureCard icon={<Grid3x3 size={18} />} title="Session-wide breakdown"
                       body="Strike percentage, pitch locations, and a 5x5 zone grid for the whole outing — not just one pitch at a time." />
          <FeatureCard icon={<Pencil size={18} />} title="Manual review, if you need it"
                       body="Step through detections and correct anything the model got wrong — the report updates everywhere instantly." />
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
        <Reveal>
          <div className="pml-glass pml-spot rounded-3xl p-10 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0"
                 style={{ background: 'radial-gradient(50% 60% at 50% 0%, rgba(29,140,248,0.12), transparent 70%)' }} />
            <div className="relative">
              <h2 className="font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.6rem,4vw,2.4rem)', color: '#e8eaf0' }}>
                Start tracking your next session
              </h2>
              <p className="mt-3 max-w-md mx-auto text-sm" style={{ color: '#6b7a99' }}>
                Free to try. Upload a clip and see your first tracked pitch in minutes.
              </p>
              <Link to="/signup"
                    className="pml-btn-pop mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
                    style={{ background: '#1d8cf8', color: '#fff' }}>
                Get started <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Reveal delay={n * 0.08}>
      <div className="pml-glass pml-spot rounded-2xl p-6 h-full">
        <div className="relative flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl"
                style={{ background: 'rgba(29,140,248,0.12)', color: '#1d8cf8' }}>
            {icon}
          </span>
          <span className="text-xs" style={{ color: '#3a4460' }}>Step {n}</span>
        </div>
        <h3 className="relative mt-4 text-base font-semibold" style={{ color: '#e8eaf0' }}>{title}</h3>
        <p className="relative mt-2 text-sm leading-relaxed" style={{ color: '#6b7a99' }}>{body}</p>
      </div>
    </Reveal>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Reveal>
      <div className="pml-glass pml-spot rounded-2xl p-6 h-full flex gap-4">
        <span className="relative flex items-center justify-center size-10 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(29,140,248,0.12)', color: '#1d8cf8' }}>
          {icon}
        </span>
        <div className="relative">
          <h3 className="text-base font-semibold" style={{ color: '#e8eaf0' }}>
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#6b7a99' }}>{body}</p>
        </div>
      </div>
    </Reveal>
  );
}
