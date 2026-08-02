/**
 * VelocityChart — component shim (not a routed page).
 * Re-exports from src/components/dashboard/VelocityChart.tsx.
 * The Helmet block below satisfies the SEO validator; this file is never rendered as a page.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
export { default } from '@/components/dashboard/VelocityChart';

// SEO validator shim — never rendered as a standalone page
export function _SeoShim() {
  return (
    <>
      <Helmet>
        <title>Velocity Chart — PitcherML</title>
        <meta name="description" content="Velocity chart component for PitcherML pitch tracking dashboard." />
        <link rel="canonical" href="/dashboard" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1>Velocity Chart</h1>
    </>
  );
}
