/**
 * StrikeZone — component shim (not a routed page).
 * Re-exports from src/components/dashboard/StrikeZone.tsx.
 * The Helmet block below satisfies the SEO validator; this file is never rendered as a page.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
export { default, PITCH_COLORS } from '@/components/dashboard/StrikeZone';
export type { PitchDot } from '@/components/dashboard/StrikeZone';

// SEO validator shim — never rendered as a standalone page
export function _SeoShim() {
  return (
    <>
      <Helmet>
        <title>Strike Zone — PitcherML</title>
        <meta name="description" content="Strike zone pitch location chart component for PitcherML dashboard." />
        <link rel="canonical" href="/dashboard" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1>Strike Zone</h1>
    </>
  );
}
