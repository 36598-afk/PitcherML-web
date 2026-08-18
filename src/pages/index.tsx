import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useSession } from '@/lib/auth/auth-client';
import {
  Loader2, Target, Activity, Grid3x3, Pencil, Film, Crosshair, Check, X, Mail,
} from 'lucide-react';
import Header from '@/layouts/parts/Header';
import Footer from '@/layouts/parts/Footer';
import Silk from '@/components/brand/Silk';
import MetallicPaint from '@/components/brand/MetallicPaint';
import Reveal from '@/components/landing/Reveal';
import { prefersReducedMotion } from '@/lib/motion';

/** True only after the component has mounted in the browser. SVG SMIL
 *  animations (<animate>, <animateMotion>) start running the instant the
 *  browser parses the raw HTML -- before React even loads -- so by the
 *  time React hydrates and compares the DOM, the animated attributes have
 *  already drifted from what the server rendered, which trips a hydration
 *  mismatch (the same class of bug as the earlier `motion` one, different
 *  mechanism). Rendering the static, non-animating markup until mount and
 *  swapping in the animated version afterward avoids it entirely. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

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

        {/* ===== Brand landing ===== */}
        <section id="top" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-60"><Silk color="#123a6b" /></div>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(75% 70% at 50% 50%, rgba(12,12,12,0.25) 0%, rgba(12,12,12,0.82) 78%, #0c0c0c 100%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(48% 42% at 50% 48%, rgba(29,140,248,0.09), transparent 70%)' }} />
          <div className="relative flex items-center gap-5 sm:gap-6">
            <div className="size-[140px] sm:size-[220px]"><MetallicPaint /></div>
            <span className="text-[clamp(3.25rem,9vw,7rem)] font-bold tracking-[-0.03em] text-white">PitcherML</span>
          </div>
          <span className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[0.8rem] font-semibold tracking-[0.04em]" style={{ color: 'var(--color-positive)' }}>
            Free to try
          </span>
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
                <span className="size-1.5 rounded-full" style={{ background: 'var(--color-positive)' }} /> Free — ball tracking + pitch analytics, from a phone video
              </span>
              <h1 className="mt-6 text-[clamp(2.1rem,5.2vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
                Point a camera.
                <br />
                <span style={{ color: 'var(--color-accent)' }}>Get a real pitch report.</span>
              </h1>
              <p className="mt-6 max-w-[32rem] text-[1.05rem] leading-relaxed text-white/65">
                Upload bullpen or game footage and PitcherML tracks the ball automatically —
                flight path, impact point, and strike-zone location for every pitch, with a
                full session report you can review pitch by pitch. Free to try, no card needed.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="btn-primary">Sign up free</Link>
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

        {/* ===== How it works (product showcase) ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-16">
          <SectionKicker>How it works</SectionKicker>
          <h2 className="mt-4 max-w-[30rem] text-[clamp(1.6rem,3.6vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em]">
            See exactly what you get. Free.
          </h2>

          {/* Live tracking video -- pick between a few real traced examples.
              DROP REAL CLIPS IN: put video files in /public/videos/ and add
              an entry to TRACED_EXAMPLES below with the matching path. */}
          <Reveal className="mt-8">
            <TracedClipsShowcase />
          </Reveal>

          {/* Trace animation + manual review, side by side */}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Reveal className="glass spot rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-[0.85rem] font-semibold">Every pitch, traced automatically</span>
              </div>
              <HeroTrace bare />
            </Reveal>
            <Reveal className="glass spot rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Pencil size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-[0.85rem] font-semibold">Manual review, if you need it</span>
              </div>
              <ManualReviewDemo />
            </Reveal>
          </div>

          {/* The 3 session-end graphs */}
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Reveal className="glass spot rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Target size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-[0.85rem] font-semibold">Pitch locations</span>
              </div>
              <LocationPlotDemo />
            </Reveal>
            <Reveal className="glass spot rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Grid3x3 size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-[0.85rem] font-semibold">Strike zone heatmap</span>
              </div>
              <HeatmapDemo />
            </Reveal>
            <Reveal className="glass spot rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Crosshair size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-[0.85rem] font-semibold">Zone breakdown</span>
              </div>
              <ZoneGridDemo />
            </Reveal>
          </div>
          <p className="mt-4 text-[0.75rem] text-white/40">Illustrative data. Your real session report is generated from your own footage.</p>
        </section>

        {/* ===== Request the app ===== */}
        <section className="mx-auto max-w-[100rem] px-[clamp(1.5rem,4vw,4.5rem)] py-16">
          <RequestAppSection />
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

/* ── the signature intro ─────────────────────────────────────────────────── */
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

function GetStartedCta() {
  return (
    <Reveal className="glass spot relative overflow-hidden rounded-3xl px-8 py-14 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(29,140,248,0.15), transparent 70%)' }} />
      <div className="relative mx-auto max-w-[34rem]">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.72rem] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-positive)' }}>
          Free to try
        </span>
        <h2 className="mt-4 text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em]">Start tracking your next session</h2>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-white/60">
          Upload a clip and see your first tracked pitch in minutes. No cost to try.
        </p>
        <Link to="/signup" className="btn-primary mt-6">Sign up free</Link>
      </div>
    </Reveal>
  );
}

/* ── Request the app (email capture -> TestFlight) ──────────────────────────
   Fill this in once the public TestFlight link exists (App Store Connect ->
   TestFlight tab -> External Testing group -> Public Link toggle). Until
   then this stays null and the success state just confirms the email was
   saved, without an "Open TestFlight" button that would 404. */
const TESTFLIGHT_URL: string | null = 'https://testflight.apple.com/join/efh9eCMd';

function RequestAppSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/app-access-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <Reveal className="glass spot relative overflow-hidden rounded-3xl px-8 py-14">
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(29,140,248,0.15), transparent 70%)' }} />
      <div className="relative mx-auto max-w-[36rem] text-center">
        <SectionKicker>Mobile app</SectionKicker>
        <h2 className="mt-4 text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em]">Request the app</h2>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-white/60">
          The PitcherML iOS app is in TestFlight. Enter your email and we'll send you access
          along with instructions for installing TestFlight.
        </p>

        {status === 'done' ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2 text-[0.95rem] font-semibold" style={{ color: 'var(--color-positive)' }}>
              <Check size={18} /> Got it — we'll be in touch.
            </div>
            {TESTFLIGHT_URL && (
              <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Open TestFlight
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2.5 w-full sm:w-auto sm:min-w-[20rem]">
              <Mail size={16} className="text-white/40 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30"
              />
            </div>
            <button type="submit" disabled={status === 'sending'} className="btn-primary w-full sm:w-auto">
              {status === 'sending' ? 'Sending…' : 'Request access'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.8rem]" style={{ color: 'var(--color-negative)' }}>
            <X size={14} /> Something went wrong — try again in a moment.
          </p>
        )}

        {/*
          INSTRUCTIONS VIDEO/IMAGE GOES HERE (how to install TestFlight).
          Replace this block once the file is available.
        */}
        <div className="mt-8 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="aspect-video flex flex-col items-center justify-center gap-2" style={{ background: '#070a10' }}>
            <Film size={28} style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-accent)' }}>
              Install instructions coming soon
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Product showcase demos (illustrative sample data) ──────────────────────── */

const DEMO_ZONE = { top: 0.32, bottom: 0.72, left: 0.36, right: 0.64 };
const DEMO_PITCHES: { x: number; y: number; strike: boolean }[] = [
  { x: 0.48, y: 0.45, strike: true }, { x: 0.52, y: 0.5, strike: true },
  { x: 0.42, y: 0.4, strike: true }, { x: 0.58, y: 0.6, strike: true },
  { x: 0.5, y: 0.55, strike: true }, { x: 0.46, y: 0.62, strike: true },
  { x: 0.6, y: 0.42, strike: true }, { x: 0.55, y: 0.48, strike: true },
  { x: 0.3, y: 0.35, strike: false }, { x: 0.7, y: 0.65, strike: false },
  { x: 0.25, y: 0.55, strike: false }, { x: 0.62, y: 0.25, strike: false },
  { x: 0.4, y: 0.75, strike: false }, { x: 0.5, y: 0.52, strike: true },
];

function DemoZoneBox() {
  const l = DEMO_ZONE.left * 100, r = DEMO_ZONE.right * 100, t = DEMO_ZONE.top * 100, b = DEMO_ZONE.bottom * 100;
  return (
    <>
      <rect x={l} y={t} width={r - l} height={b - t} fill="rgba(29,140,248,0.06)" stroke="var(--color-accent)" strokeWidth={0.5} />
      {[1, 2].map((i) => (
        <g key={i}>
          <line x1={l + (r - l) * i / 3} y1={t} x2={l + (r - l) * i / 3} y2={b} stroke="var(--color-accent)" strokeWidth={0.2} opacity={0.5} />
          <line x1={l} y1={t + (b - t) * i / 3} x2={r} y2={t + (b - t) * i / 3} stroke="var(--color-accent)" strokeWidth={0.2} opacity={0.5} />
        </g>
      ))}
    </>
  );
}

function LocationPlotDemo() {
  return (
    <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', background: '#070a10', borderRadius: 8 }}>
      <DemoZoneBox />
      {DEMO_PITCHES.map((p, i) => (
        <circle key={i} cx={p.x * 100} cy={p.y * 100} r={1.6}
                fill={p.strike ? '#22c55e' : '#ef4444'} stroke="rgba(0,0,0,0.4)" strokeWidth={0.3} opacity={0.9} />
      ))}
    </svg>
  );
}

function HeatmapDemo() {
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: '#070a10', aspectRatio: '1/1' }}>
      {DEMO_PITCHES.map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: 46, height: 46,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(239,68,68,0.35), rgba(239,68,68,0) 70%)',
          filter: 'blur(4px)',
        }} />
      ))}
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="absolute inset-0"><DemoZoneBox /></svg>
    </div>
  );
}

function ZoneGridDemo() {
  const counts = [
    [0, 1, 1, 0, 0], [0, 1, 2, 1, 0], [0, 2, 3, 2, 0], [0, 1, 2, 1, 0], [0, 0, 1, 0, 0],
  ];
  const max = Math.max(...counts.flat(), 1);
  return (
    <div className="grid grid-cols-5 gap-1" style={{ aspectRatio: '1/1' }}>
      {counts.flat().map((c, i) => {
        const t = c / max;
        return (
          <div key={i} className="rounded flex items-center justify-center text-[0.65rem] font-semibold tnum"
               style={{ background: `rgba(29,140,248,${0.08 + t * 0.5})`, color: t > 0.4 ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {c || ''}
          </div>
        );
      })}
    </div>
  );
}

/* ── Real traced pitch examples ──────────────────────────────────────────────
   Add entries here once clips are uploaded to /public/videos/. Keep each
   short (5-15s) and reasonably compressed -- these are committed straight
   into the repo as static files, not streamed from B2 like real user
   session videos, so file size directly affects page load time. Empty
   array falls back to the "coming soon" placeholder automatically. */
const TRACED_EXAMPLES: { label: string; src: string }[] = [
  { label: 'Pitch 1', src: '/videos/example-1.mp4' },
  { label: 'Pitch 2', src: '/videos/example-2.mp4' },
  { label: 'Pitch 3', src: '/videos/example-3.mp4' },
  { label: 'Pitch 4', src: '/videos/example-4.mp4' },
  { label: 'Pitch 5', src: '/videos/example-5.mp4' },
];

function TracedClipsShowcase() {
  const [active, setActive] = useState(0);

  if (TRACED_EXAMPLES.length === 0) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        <div className="aspect-video relative flex flex-col items-center justify-center gap-3" style={{ background: '#070a10' }}>
          <Film size={32} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-accent)' }}>
            Traced examples coming soon
          </span>
          <span className="text-xs text-white/40 max-w-sm text-center px-6">
            A few real pitches being actively traced, live — this slot is ready for them.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="aspect-video" style={{ background: '#070a10' }}>
        <video
          key={TRACED_EXAMPLES[active].src}
          src={TRACED_EXAMPLES[active].src}
          controls
          playsInline
          className="w-full h-full object-contain"
        />
      </div>
      {TRACED_EXAMPLES.length > 1 && (
        <div className="flex flex-wrap gap-2 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {TRACED_EXAMPLES.map((clip, i) => (
            <button
              key={clip.src}
              onClick={() => setActive(i)}
              className="text-[0.8rem] font-medium px-3.5 py-1.5 rounded-full transition-colors"
              style={
                i === active
                  ? { background: 'var(--color-accent)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              {clip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualReviewDemo() {
  const pts = [{ x: 0.3, y: 0.3 }, { x: 0.4, y: 0.4 }, { x: 0.5, y: 0.5 }, { x: 0.62, y: 0.58 }];
  const current = pts[2];
  return (
    <div>
      <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block', background: '#070a10', borderRadius: 8 }}>
        <polyline points={pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth={0.6} strokeLinecap="round" />
        {pts.map((p, i) => {
          const isCurrent = p === current;
          return <circle key={i} cx={p.x * 100} cy={p.y * 100} r={isCurrent ? 2.4 : 1} fill={isCurrent ? '#eab308' : 'var(--color-accent)'} stroke={isCurrent ? '#fff' : 'none'} strokeWidth={isCurrent ? 0.4 : 0} />;
        })}
      </svg>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[0.75rem] font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-negative)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <X size={12} /> Delete
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[0.75rem] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-positive)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <Check size={12} /> Keep
        </div>
      </div>
    </div>
  );
}

/** The signature visual: same ball-trace visualization used on the actual
 *  report page, animated via native SVG <animateMotion>/<animate> tags
 *  rather than JS-driven `motion` -- declarative markup renders identically
 *  server- and client-side, so there's no hydration-mismatch risk the way
 *  a `motion.path` would have here. Loops continuously as a placeholder
 *  until a real traced clip replaces it. */
function HeroTrace({ bare = false }: { bare?: boolean }) {
  const mounted = useMounted();
  const d = 'M 8,78 C 20,55 34,30 50,18 C 66,6 82,10 92,28';
  const svg = (
    <svg viewBox="0 0 100 90" className="block h-auto w-full">
      {[25, 50, 75].map((v) => (
        <g key={v}>
          <line x1={v} y1={0} x2={v} y2={90} stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} strokeDasharray="2 2" />
          <line x1={0} y1={v * 0.9} x2={100} y2={v * 0.9} stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} strokeDasharray="2 2" />
        </g>
      ))}
      <path d={d} fill="none" stroke="#dc2626" strokeWidth={3.4} strokeLinecap="round" opacity={0.3} />
      {mounted ? (
        <path
          d={d} fill="none" stroke="#f87171" strokeWidth={0.7} strokeLinecap="round"
          pathLength={100} strokeDasharray="100" strokeDashoffset="100"
        >
          <animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;0.55;0.85;1"
                   dur="3.2s" repeatCount="indefinite" calcMode="spline"
                   keySplines="0.16 1 0.3 1; 0 0 1 1; 0.6 0 0.4 1" />
        </path>
      ) : (
        <path d={d} fill="none" stroke="#f87171" strokeWidth={0.7} strokeLinecap="round" />
      )}
      <circle cx={8} cy={78} r={1.2} fill="var(--color-accent)" />
      {mounted && (
        <circle r={1.6} fill="#fff" stroke="#f87171" strokeWidth={0.5}>
          <animateMotion path={d} dur="3.2s" keyPoints="0;1;1;0" keyTimes="0;0.55;0.85;1"
                         calcMode="spline" keySplines="0.16 1 0.3 1; 0 0 1 1; 0.6 0 0.4 1" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;1;0" keyTimes="0;0.05;0.55;0.85;0.9" dur="3.2s" repeatCount="indefinite" />
        </circle>
      )}
      <g>
        <circle cx={92} cy={28} r={3.4} fill="#dc2626" opacity={0.3} />
        <circle cx={92} cy={28} r={1.9} fill="#dc2626" stroke="#fff" strokeWidth={0.4} />
        <text x={92} y={22.5} textAnchor="middle" fontSize={3.6} fontWeight={800} fill="#fff"
              stroke="#000" strokeWidth={0.6} paintOrder="stroke">IMPACT</text>
      </g>
    </svg>
  );
  if (bare) return svg;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.8rem] text-white/60">Every pitch, tracked automatically</span>
        <span className="tnum rounded-full px-2.5 py-1 text-[0.72rem] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-positive)' }}>
          free
        </span>
      </div>
      {svg}
      <p className="mt-1 text-[0.75rem] text-white/45">Illustrative. Your real trace is synced to your video's own playback.</p>
    </div>
  );
}
