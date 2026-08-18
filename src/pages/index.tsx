import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useSession } from '@/lib/auth/auth-client';
import {
  Loader2, Target, Activity, Grid3x3, Pencil, Film, Crosshair,
} from 'lucide-react';
import Header from '@/layouts/parts/Header';
import Footer from '@/layouts/parts/Footer';
import Silk from '@/components/brand/Silk';
import MetallicPaint from '@/components/brand/MetallicPaint';
import Reveal from '@/components/landing/Reveal';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * The entire site is sign-in -> tool, so this decides which of those two
 * an authenticated visitor lands on. An UNAUTHENTICATED visitor gets the
 * actual landing page below instead of an immediate bounce to /login.
 *
 * This is a direct structural port of Signal's landing page (the signature
 * intro, MetallicPaint emblem, Silk background, exact CSS design system --
 * .glass/.btn-primary/.tap/.tnum, the Intro sequence) with copy and product
 * content swapped for PitcherML. Two things were NOT ported 1:1, both
 * called out inline where they happen:
 *   - Lenis (smooth-scroll library) isn't an existing dependency here, and
 *     adding one risks a broken build if the lockfile isn't updated right.
 *     Native `scroll-behavior: smooth` (already in this file) is the
 *     fallback.
 *   - The CommodityCarousel and the honest-numbers stat panel were
 *     commodity-price-specific (real backtested trading data) and don't
 *     have a PitcherML equivalent to port honestly -- replaced with a
 *     feature grid using the identical .glass/.spot card treatment.
 */
export default function RootPage() {
  const { isAuthenticated, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0c0c' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d8cf8' }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/players" replace />;
  }

  return <Landing />;
}

export function Landing() {
  // The signature intro plays once per session (skipped for reduced motion).
  const [introPlaying] = useState(() => {
    if (typeof window === 'undefined' || prefersReducedMotion()) return false;
    try {
      return !sessionStorage.getItem('pitcherMLIntroSeen');
    } catch {
      return false;
    }
  });
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!introPlaying) return;
    try {
      sessionStorage.setItem('pitcherMLIntroSeen', '1');
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setIntroDone(true), 4200);
    return () => clearTimeout(t);
  }, [introPlaying]);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#0c0c0c', color: '#fff' }}>
      <Intro playing={introPlaying} />
      <div
        style={
          introPlaying && !introDone
            ? { animation: 'introUnblur 1.4s ease-out 2.4s both' }
            : undefined
        }
      >
        <Grain />

        {/* ===== Brand landing (full screen: metallic emblem, then scroll) ===== */}
        <section id="top" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-60"><Silk color="#123a6b" /></div>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(75% 70% at 50% 50%, rgba(12,12,12,0.25) 0%, rgba(12,12,12,0.82) 78%, #0c0c0c 100%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(48% 42% at 50% 48%, rgba(29,140,248,0.09), transparent 70%)' }} />
          <div className="relative flex items-center gap-5 sm:gap-6">
            <div className="size-[140px] sm:size-[220px]"><MetallicPaint /></div>
            <span className="text-[clamp(3.25rem,9vw,7rem)] font-bold tracking-[-0.03em] text-white">PitcherML</span>
          </div>
          <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-1.5 text-[0.72rem] tracking-[0.12em] text-white/40">
            <span>SCROLL</span>
            <svg viewBox="0 0 24 24" className="size-4 [animation:sig-fadeIn_1s_ease-in-out_infinite_alternate]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </section>

        <Header />

        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(72% 64% at 50% 38%, rgba(12,12,12,0.2) 0%, rgba(12,12,12,0.86) 74%, #0c0c0c 100%)' }} />
          <div className="relative mx-auto grid max-w-[100rem] items-center gap-10 px-[clamp(1.5rem,4vw,4.5rem)] pb-16 pt-20 md:grid-cols-2 md:pt-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[0.72rem] tracking-[0.04em] text-white/60">
                <span className="size-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} /> Ball tracking + pitch analytics, from a phone video
              </span>
              <h1 className="mt-6 text-[clamp(2.1rem,5.2vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
                Point a camera.
                <br />
                <span style={{ color: 'var(--color-accent)' }}>Get a real pitch report.</span>
              </h1>
              <p className="mt-6 max-w-[32rem] text-[1.05rem] leading-relaxed text-white/65">
                Upload bullpen or game footage and PitcherML tracks the ball automatically —
                flight path, impact point, and strike-zone location for every pitch, with a
                full session report you can review pitch by pitch.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="btn-primary">Get started</Link>
                <Link to="/login" className="btn-ghost">Log in</Link>
              </div>
              <p className="mt-4 text-[0.8rem] text-white/45">
                No special cameras or markers needed. Works with footage you already have.
              </p>
            </div>
            <Reveal className="w-full">
              <HeroTrace />
            </Reveal>
          </div>
        </section>

        {/* ===== How it works ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-16">
          <SectionKicker>How it works</SectionKicker>
          <h2 className="mt-4 max-w-[26rem] text-[clamp(1.6rem,3.6vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em]">
            Three steps. No manual tagging.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Step n={1} title="Upload your video" body="A bullpen session or game clip from any angle-consistent camera — phone footage works fine." icon={<Film size={18} />} />
            <Step n={2} title="We track the ball" body="Every pitch gets its flight path detected automatically, frame by frame, down to the impact point." icon={<Activity size={18} />} />
            <Step n={3} title="Get your report" body="Strike zone heatmap, pitch locations, and a full breakdown — ready as soon as processing finishes." icon={<Grid3x3 size={18} />} />
          </div>
        </section>

        {/* ===== What you get ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-6">
          <SectionKicker>What you get</SectionKicker>
          <h2 className="mt-4 text-[clamp(1.6rem,3.6vw,2.4rem)] font-semibold tracking-[-0.02em]">
            Built around the actual pitch, not just the result.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
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

        {/* ===== FAQ ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-10">
          <SectionKicker>Straight answers</SectionKicker>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Faq q="What kind of video do I need?" a="A bullpen session or game clip from a fixed, angle-consistent camera — a phone works fine. The ball needs to be visible against the background for most of its flight." />
            <Faq q="What if the tracking gets a pitch wrong?" a="You can step through the detections for any pitch and correct them by hand. The fix applies instantly everywhere — the zone plot, the video overlay, and every session-wide chart." />
            <Faq q="Do I need special cameras or markers?" a="No. No calibration rig, no reflective markers, no fixed stadium camera. Just a reasonably steady shot of the pitch." />
            <Faq q="Is this free to try?" a="Yes — sign up and upload a clip to see your first tracked pitch and report." />
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-16">
          <GetStartedCta />
        </section>

        <Footer />
      </div>
    </div>
  );
}

/* ── the signature intro (arc-and-target mark draws, opens, zooms through) ─── */
function Intro({ playing }: { playing: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setGone(true), 4100);
    return () => clearTimeout(t);
  }, [playing]);
  if (!playing || gone) return null;

  const OPEN_D =
    'M-4000 -4000 H5000 V5000 H-4000 Z M410 500 C 470 500 520 470 598 425 C 612 430 619 462 618 500 C 520 500 470 500 410 500 Z M410 500 C 470 500 520 530 598 575 C 612 570 619 538 618 500 C 520 500 470 500 410 500 Z';
  const strokeStyle: React.CSSProperties = {
    strokeDasharray: '100 110',
    strokeDashoffset: 105,
    animation:
      'heroDraw 1s cubic-bezier(.22,1,.36,1) .25s forwards, introFadeOut 0.5s ease-out 2.3s forwards',
  };
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{ animation: 'introOut 0.01s linear 4s forwards' }}
    >
      <div
        className="absolute inset-0"
        style={{ background: '#0c0c0c', animation: 'introFadeOut 0.45s ease-out 2.15s forwards' }}
      />
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <g style={{ transformOrigin: '500px 500px', animation: 'introZoom 1.7s cubic-bezier(.7,0,.3,1) 2.2s forwards' }}>
          <path
            fill="#1d8cf8"
            fillRule="evenodd"
            d={OPEN_D}
            style={{ animation: 'introOpen 0.9s cubic-bezier(.6,0,.2,1) 1.3s both, introUnify 0.01s linear 2.21s forwards' }}
          />
          <path d="M410 500 C 470 500 520 470 590 430" pathLength={100} fill="none" stroke="#0c0c0c" strokeWidth={26} strokeLinecap="round" style={strokeStyle} />
          <path d="M410 500 C 470 500 520 530 590 570" pathLength={100} fill="none" stroke="#0c0c0c" strokeWidth={26} strokeLinecap="round" style={strokeStyle} />
          <circle cx="410" cy="500" r="16" fill="#0c0c0c" style={{ opacity: 0, animation: 'sig-fadeIn 0.4s ease-out .2s both, introFadeOut 0.5s ease-out 2.3s forwards' }} />
        </g>
      </svg>
    </div>
  );
}

function Grain() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 opacity-[0.05]" style={{ mixBlendMode: 'overlay' }}>
      <svg className="size-full">
        <filter id="pml-grain"><feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#pml-grain)" />
      </svg>
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="tap flex items-center gap-2.5">
      <span className="size-1.5 rounded-full bg-white" />
      <span className="text-[0.8rem] uppercase tracking-[0.14em] text-white/55">{children}</span>
    </div>
  );
}

function Step({ n, title, body, icon }: { n: number; title: string; body: string; icon: React.ReactNode }) {
  return (
    <Reveal delay={n * 0.06} className="glass spot rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: 'rgba(29,140,248,0.12)', color: 'var(--color-accent)' }}>{icon}</span>
        <span className="tnum text-[0.8rem] text-white/40">Step {n}</span>
      </div>
      <h3 className="mt-4 text-[1.15rem] font-semibold">{title}</h3>
      <p className="mt-2 text-[0.92rem] leading-relaxed text-white/60">{body}</p>
    </Reveal>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Reveal className="glass spot rounded-2xl p-6 flex gap-4">
      <span className="flex size-10 items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(29,140,248,0.12)', color: 'var(--color-accent)' }}>
        {icon}
      </span>
      <div>
        <h3 className="text-[1.05rem] font-semibold">{title}</h3>
        <p className="mt-1.5 text-[0.92rem] leading-relaxed text-white/60">{body}</p>
      </div>
    </Reveal>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((o) => !o)} className="glass rounded-2xl p-5 text-left transition-colors hover:border-white/20">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[1rem] font-semibold">{q}</span>
        <span className="transition-transform" style={{ color: 'var(--color-accent)', transform: open ? 'rotate(45deg)' : undefined }}>+</span>
      </div>
      {open && <p className="mt-3 text-[0.92rem] leading-relaxed text-white/65">{a}</p>}
    </button>
  );
}

function GetStartedCta() {
  return (
    <Reveal className="glass spot relative overflow-hidden rounded-3xl px-8 py-14 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(29,140,248,0.15), transparent 70%)' }} />
      <div className="relative mx-auto max-w-[34rem]">
        <h2 className="text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em]">Start tracking your next session</h2>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-white/60">
          Free to try. Upload a clip and see your first tracked pitch in minutes.
        </p>
        <Link to="/signup" className="btn-primary mt-6">Get started</Link>
      </div>
    </Reveal>
  );
}

/** The signature visual, recast from Signal's flat-vs-split chart: the same
 *  ball-trace visualization used on the actual report page, drawn once here
 *  as a static illustrative curve. */
function HeroTrace() {
  const d = 'M 8,78 C 20,55 34,30 50,18 C 66,6 82,10 92,28';
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.8rem] text-white/60">Every pitch, tracked automatically</span>
        <span className="tnum rounded-full px-2.5 py-1 text-[0.72rem] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-positive)' }}>
          frame by frame
        </span>
      </div>
      <svg viewBox="0 0 100 90" className="block h-auto w-full">
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={90} stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} strokeDasharray="2 2" />
            <line x1={0} y1={v * 0.9} x2={100} y2={v * 0.9} stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} strokeDasharray="2 2" />
          </g>
        ))}
        <path d={d} fill="none" stroke="#dc2626" strokeWidth={3.4} strokeLinecap="round" opacity={0.3} />
        <path d={d} fill="none" stroke="#f87171" strokeWidth={0.7} strokeLinecap="round" />
        <circle cx={8} cy={78} r={1.2} fill="var(--color-accent)" />
        <g>
          <circle cx={92} cy={28} r={3.4} fill="#dc2626" opacity={0.3} />
          <circle cx={92} cy={28} r={1.9} fill="#dc2626" stroke="#fff" strokeWidth={0.4} />
          <text x={92} y={22.5} textAnchor="middle" fontSize={3.6} fontWeight={800} fill="#fff"
                stroke="#000" strokeWidth={0.6} paintOrder="stroke">IMPACT</text>
        </g>
      </svg>
      <p className="mt-1 text-[0.75rem] text-white/45">Illustrative. Your real trace is synced to your video's own playback.</p>
    </div>
  );
}
