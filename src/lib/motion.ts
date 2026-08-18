/**
 * Shared motion config, ported from Signal. Long custom eases, nothing
 * linear or bouncy. Respects prefers-reduced-motion.
 */
import type { Variants } from 'motion/react';

export const EASE_SIGNAL = [0.16, 1, 0.3, 1] as const;
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Staggered fade+rise for lists/cards. Calm distances; disabled if reduced. */
export function fadeRise(delay = 0, y = 14): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0 : 0.7, ease: EASE_SIGNAL, delay },
    },
  };
}

export const staggerParent = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});
