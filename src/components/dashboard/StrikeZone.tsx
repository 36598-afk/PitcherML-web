/**
 * StrikeZone — upgraded with view modes:
 *   'dots'    — individual pitch dots (original behaviour)
 *   'heat'    — Gaussian kernel density heat map
 *   'type'    — dots filtered/coloured by pitch type, with type selector
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PitchDot {
  id: number;
  x: number;       // -1 (inside) to 1 (outside), catcher's view
  y: number;       // 0 (low) to 1 (high)
  type: string;
  result: string;
  velocity?: number | null;
}

export const PITCH_COLORS: Record<string, string> = {
  Fastball:  '#1d8cf8',
  Curveball: '#a855f7',
  Slider:    '#f59e0b',
  Changeup:  '#22c55e',
  Cutter:    '#06b6d4',
  Sinker:    '#f97316',
  Splitter:  '#ec4899',
  Other:     '#94a3b8',
};

export type ViewMode = 'dots' | 'heat' | 'type';

// ─── Zone geometry (shared) ───────────────────────────────────────────────────

const W = 280;
const H = 320;
const ZL = W * 0.2;   // zone left
const ZT = H * 0.15;  // zone top
const ZW = W * 0.6;   // zone width
const ZH = H * 0.55;  // zone height

function toSvg(x: number, y: number) {
  const px = ZL + ((x + 1) / 2) * ZW;
  const py = ZT + (1 - y) * ZH;
  return { px, py };
}

// ─── Heat map helpers ─────────────────────────────────────────────────────────

const GRID = 20; // cells per axis

function buildHeatGrid(pitches: PitchDot[]): number[][] {
  const grid: number[][] = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
  const sigma = 0.25; // in normalised coords (0-1 range)

  for (const p of pitches) {
    // Normalise to 0-1 within the zone
    const nx = (p.x + 1) / 2;
    const ny = p.y;

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const cx = (col + 0.5) / GRID;
        const cy = (row + 0.5) / GRID;
        const dx = nx - cx;
        const dy = ny - cy;
        const d2 = dx * dx + dy * dy;
        grid[row][col] += Math.exp(-d2 / (2 * sigma * sigma));
      }
    }
  }
  return grid;
}

// Map a 0-1 value to a heat colour (blue → cyan → green → yellow → red)
function heatColor(t: number): string {
  // stops: 0=navy, 0.25=blue, 0.5=cyan, 0.75=yellow, 1=red
  const stops: [number, number, number][] = [
    [10, 15, 40],
    [29, 140, 248],
    [6, 182, 212],
    [245, 158, 11],
    [239, 68, 68],
  ];
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, stops.length - 1);
  const frac = idx - lo;
  const r = Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac);
  const g = Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac);
  const b = Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac);
  return `rgb(${r},${g},${b})`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ZoneFrame({ showLabel = true }: { showLabel?: boolean }) {
  const thirds = [1 / 3, 2 / 3];
  return (
    <>
      {/* Outer background */}
      <rect x={ZL - 20} y={ZT - 20} width={ZW + 40} height={ZH + 60} rx={4}
        fill="rgba(26,34,64,0.4)" stroke="#1a2240" strokeWidth={1} />

      {/* Zone thirds */}
      {thirds.map((t) => (
        <g key={t}>
          <line x1={ZL} y1={ZT + t * ZH} x2={ZL + ZW} y2={ZT + t * ZH}
            stroke="#1a2240" strokeWidth={0.8} strokeDasharray="3 3" />
          <line x1={ZL + t * ZW} y1={ZT} x2={ZL + t * ZW} y2={ZT + ZH}
            stroke="#1a2240" strokeWidth={0.8} strokeDasharray="3 3" />
        </g>
      ))}

      {/* Strike zone border */}
      <rect x={ZL} y={ZT} width={ZW} height={ZH} rx={2}
        fill="none" stroke="rgba(29,140,248,0.5)" strokeWidth={1.5} />

      {/* Label */}
      {showLabel && (
        <text x={ZL + ZW / 2} y={ZT - 8} textAnchor="middle"
          fontSize={9} fill="rgba(107,122,153,0.8)"
          fontFamily="var(--font-sans)" letterSpacing="0.05em">
          STRIKE ZONE
        </text>
      )}

      {/* Home plate */}
      {(() => {
        const px = ZL + ZW / 2;
        const py = ZT + ZH + 28;
        const pw = ZW * 0.55;
        const ph = 14;
        return (
          <polygon
            points={`${px - pw / 2},${py - ph / 2} ${px + pw / 2},${py - ph / 2} ${px + pw / 2},${py} ${px},${py + ph / 2} ${px - pw / 2},${py}`}
            fill="rgba(29,140,248,0.06)" stroke="rgba(29,140,248,0.25)" strokeWidth={1} />
        );
      })()}
    </>
  );
}

// ─── Dots view ────────────────────────────────────────────────────────────────

function DotsView({ pitches, highlight }: { pitches: PitchDot[]; highlight?: string }) {
  function resultBorder(result: string) {
    if (result === 'ball') return '#ef4444';
    if (result === 'hit') return '#f59e0b';
    return 'transparent';
  }

  return (
    <>
      {pitches.map((p, i) => {
        const { px, py } = toSvg(p.x, p.y);
        const color = PITCH_COLORS[p.type] ?? PITCH_COLORS.Other;
        const border = resultBorder(p.result);
        const dimmed = highlight && p.type !== highlight;
        return (
          <motion.g
            key={p.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: dimmed ? 0.18 : 1 }}
            transition={{ duration: 0.25, delay: i * 0.015, ease: 'easeOut' as const }}
            style={{ transformOrigin: `${px}px ${py}px` }}
          >
            {border !== 'transparent' && (
              <circle cx={px} cy={py} r={8} fill="none" stroke={border} strokeWidth={1.5} opacity={0.7} />
            )}
            <circle cx={px} cy={py} r={5.5} fill={color} opacity={0.88}
              stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
            <text x={px} y={py + 3.5} textAnchor="middle" fontSize={5.5}
              fill="#fff" fontFamily="var(--font-sans)" fontWeight="700">
              {p.id <= 99 ? p.id : '·'}
            </text>
          </motion.g>
        );
      })}
      {pitches.length === 0 && (
        <text x={ZL + ZW / 2} y={ZT + ZH / 2 + 4} textAnchor="middle"
          fontSize={10} fill="rgba(107,122,153,0.5)" fontFamily="var(--font-sans)">
          No pitches yet
        </text>
      )}
    </>
  );
}

// ─── Heat map view ────────────────────────────────────────────────────────────

function HeatView({ pitches }: { pitches: PitchDot[] }) {
  const grid = useMemo(() => buildHeatGrid(pitches), [pitches]);

  if (pitches.length === 0) {
    return (
      <text x={ZL + ZW / 2} y={ZT + ZH / 2 + 4} textAnchor="middle"
        fontSize={10} fill="rgba(107,122,153,0.5)" fontFamily="var(--font-sans)">
        No pitches yet
      </text>
    );
  }

  const maxVal = Math.max(...grid.flat(), 0.001);
  const cellW = ZW / GRID;
  const cellH = ZH / GRID;

  return (
    <>
      {/* Clip to zone */}
      <defs>
        <clipPath id="zone-clip">
          <rect x={ZL} y={ZT} width={ZW} height={ZH} />
        </clipPath>
      </defs>
      <g clipPath="url(#zone-clip)">
        {grid.map((row, ri) =>
          row.map((val, ci) => {
            const t = val / maxVal;
            if (t < 0.02) return null;
            // row 0 = top of grid = high y; invert row index
            const x = ZL + ci * cellW;
            const y = ZT + (GRID - 1 - ri) * cellH;
            return (
              <rect key={`${ri}-${ci}`} x={x} y={y} width={cellW} height={cellH}
                fill={heatColor(t)} opacity={Math.min(0.85, t * 0.9 + 0.1)} />
            );
          })
        )}
      </g>
    </>
  );
}

// ─── Zone stats overlay ───────────────────────────────────────────────────────

function ZoneStats({ pitches }: { pitches: PitchDot[] }) {
  // Count pitches in each of 9 zones (3×3 grid)
  const zones = Array.from({ length: 9 }, () => 0);
  for (const p of pitches) {
    const col = p.x < -1 / 3 ? 0 : p.x < 1 / 3 ? 1 : 2;
    const row = p.y < 1 / 3 ? 2 : p.y < 2 / 3 ? 1 : 0; // row 0 = top
    zones[row * 3 + col]++;
  }
  const max = Math.max(...zones, 1);

  return (
    <>
      {zones.map((count, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = ZL + col * (ZW / 3) + ZW / 6;
        const y = ZT + row * (ZH / 3) + ZH / 6;
        const t = count / max;
        return (
          <g key={i}>
            <rect
              x={ZL + col * (ZW / 3) + 1}
              y={ZT + row * (ZH / 3) + 1}
              width={ZW / 3 - 2}
              height={ZH / 3 - 2}
              fill={count > 0 ? `rgba(29,140,248,${t * 0.25})` : 'transparent'}
              rx={1}
            />
            {count > 0 && (
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11}
                fill={count > 0 ? '#e8eaf0' : 'rgba(107,122,153,0.3)'}
                fontFamily="var(--font-sans)" fontWeight="700">
                {count}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  pitches: PitchDot[];
  mode?: ViewMode;
  showModeToggle?: boolean;
  showZoneStats?: boolean;
  width?: number;
  height?: number;
}

export default function StrikeZone({
  pitches,
  mode: externalMode,
  showModeToggle = false,
  showZoneStats = false,
}: Props) {
  const [internalMode, setInternalMode] = useState<ViewMode>('dots');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const mode = externalMode ?? internalMode;
  const presentTypes = [...new Set(pitches.map((p) => p.type))];

  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle */}
      {showModeToggle && (
        <div className="flex rounded overflow-hidden self-start" style={{ border: '1px solid #1a2240' }}>
          {(['dots', 'heat', 'type'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setInternalMode(m); if (m !== 'type') setSelectedType(null); }}
              className="px-3 py-1 text-xs font-semibold capitalize transition-all"
              style={{
                background: mode === m ? 'rgba(29,140,248,0.15)' : 'transparent',
                color: mode === m ? '#1d8cf8' : '#6b7a99',
              }}
            >
              {m === 'dots' ? 'Dots' : m === 'heat' ? 'Heat Map' : 'By Type'}
            </button>
          ))}
        </div>
      )}

      {/* Type filter pills (only in type mode) */}
      {mode === 'type' && presentTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedType(null)}
            className="px-2 py-0.5 rounded text-xs font-semibold transition-all"
            style={{
              background: selectedType === null ? 'rgba(29,140,248,0.15)' : 'transparent',
              color: selectedType === null ? '#1d8cf8' : '#6b7a99',
              border: `1px solid ${selectedType === null ? 'rgba(29,140,248,0.3)' : '#1a2240'}`,
            }}
          >
            All
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t === selectedType ? null : t)}
              className="px-2 py-0.5 rounded text-xs font-semibold transition-all"
              style={{
                background: selectedType === t ? `${PITCH_COLORS[t] ?? '#94a3b8'}22` : 'transparent',
                color: selectedType === t ? (PITCH_COLORS[t] ?? '#94a3b8') : '#6b7a99',
                border: `1px solid ${selectedType === t ? `${PITCH_COLORS[t] ?? '#94a3b8'}55` : '#1a2240'}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: 'block' }}
        aria-label="Strike zone pitch location chart"
      >
        <ZoneFrame />

        <AnimatePresence mode="wait">
          {mode === 'heat' ? (
            <motion.g key="heat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <HeatView pitches={pitches} />
            </motion.g>
          ) : (
            <motion.g key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <DotsView pitches={pitches} highlight={mode === 'type' ? (selectedType ?? undefined) : undefined} />
            </motion.g>
          )}
        </AnimatePresence>

        {showZoneStats && mode !== 'heat' && <ZoneStats pitches={pitches} />}
      </svg>

      {/* Heat map legend */}
      {mode === 'heat' && pitches.length > 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7a99' }}>
          <span>Low</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6 }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(to right, rgb(10,15,40), rgb(29,140,248), rgb(6,182,212), rgb(245,158,11), rgb(239,68,68))',
              }}
            />
          </div>
          <span>High</span>
        </div>
      )}
    </div>
  );
}
