/**
 * The PitcherML mark: a single tracked arc from release (white dot) to
 * impact (accent dot) — the same idea as the actual product visualization,
 * reduced to one glyph.
 */
export default function PitcherMLMark({
  size = 24,
  className = '',
  dot = true,
}: {
  size?: number | string;
  className?: string;
  dot?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path d="M3 19 C 9 15 14 9 21 5" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" />
      {dot && <circle cx="3.4" cy="19" r="1.5" fill="#fff" />}
      {dot && <circle cx="20.6" cy="5" r="1.8" fill="var(--color-accent)" />}
    </svg>
  );
}
