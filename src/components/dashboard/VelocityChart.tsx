import { motion } from 'motion/react';

interface PitchPoint {
  pitchNumber: number;
  velocity: number;
  type: string;
}

const PITCH_COLORS: Record<string, string> = {
  Fastball: '#1d8cf8',
  Curveball: '#a855f7',
  Slider: '#f59e0b',
  Changeup: '#22c55e',
  Cutter: '#06b6d4',
  Sinker: '#f97316',
  Splitter: '#ec4899',
  Other: '#94a3b8',
};

interface Props {
  pitches: PitchPoint[];
}

export default function VelocityChart({ pitches }: Props) {
  const withVelo = pitches.filter((p) => p.velocity > 0);

  if (withVelo.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#3a4460' }}>
        <p className="text-xs">Log pitches with velocity to see chart</p>
      </div>
    );
  }

  const W = 400;
  const H = 120;
  const PAD = { top: 12, right: 16, bottom: 24, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const velocities = withVelo.map((p) => p.velocity);
  const minV = Math.max(0, Math.min(...velocities) - 5);
  const maxV = Math.max(...velocities) + 5;
  const range = maxV - minV || 1;

  function toX(i: number) {
    return PAD.left + (i / Math.max(withVelo.length - 1, 1)) * chartW;
  }
  function toY(v: number) {
    return PAD.top + chartH - ((v - minV) / range) * chartH;
  }

  const linePath = withVelo
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.velocity).toFixed(1)}`)
    .join(' ');

  const fillPath = `${linePath} L ${toX(withVelo.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  // Y-axis ticks
  const ticks = [minV, (minV + maxV) / 2, maxV].map((v) => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-label="Velocity chart">
      <defs>
        <linearGradient id="veloFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d8cf8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1d8cf8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            y1={toY(t)}
            x2={PAD.left + chartW}
            y2={toY(t)}
            stroke="#1a2240"
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />
          <text
            x={PAD.left - 4}
            y={toY(t) + 3.5}
            textAnchor="end"
            fontSize={8}
            fill="#3a4460"
            fontFamily="var(--font-sans)"
          >
            {t}
          </text>
        </g>
      ))}

      {/* X-axis label */}
      <text
        x={PAD.left + chartW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={8}
        fill="#3a4460"
        fontFamily="var(--font-sans)"
      >
        Pitch #
      </text>

      {/* Fill */}
      <motion.path
        d={fillPath}
        fill="url(#veloFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Line */}
      <motion.path
        d={linePath}
        stroke="#1d8cf8"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' as const }}
      />

      {/* Dots colored by pitch type */}
      {withVelo.map((p, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(p.velocity)}
          r={3}
          fill={PITCH_COLORS[p.type] ?? PITCH_COLORS.Other}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}
