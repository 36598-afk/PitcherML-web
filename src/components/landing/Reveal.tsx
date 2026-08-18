import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE_SIGNAL, prefersReducedMotion } from '@/lib/motion';

/** Scroll-into-view fade + rise. Cinematic on the landing; disabled if reduced. */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'figure';
}) {
  const reduced = prefersReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: reduced ? 0 : 0.9, ease: EASE_SIGNAL, delay: reduced ? 0 : delay }}
    >
      {children}
    </MotionTag>
  );
}
