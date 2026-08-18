/**
 * The PitcherML mark: a simple baseball -- a filled circle with two curved
 * seam lines. Reads clearly at small sizes (nav bar, favicon) unlike a bare
 * abstract line.
 */
export default function PitcherMLMark({
  size = 24,
  className = '',
}: {
  size?: number | string;
  className?: string;
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
      <circle cx="12" cy="12" r="10" fill="var(--color-accent)" />
      <path d="M8.4 3.8C10 7.6 10 16.4 8.4 20.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M15.6 3.8C14 7.6 14 16.4 15.6 20.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
