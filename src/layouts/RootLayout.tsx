import { Helmet } from '@dr.pogodin/react-helmet';
import { type ReactElement } from 'react';
import { ScrollRestoration } from 'react-router-dom';

import Website from '@/layouts/Website';

/**
 * Root layout — deliberately minimal. This product is sign-in -> tool,
 * with no marketing site around it, so there's no Header/Footer here
 * anymore. If a marketing presence is ever wanted again, it should live
 * on its own separate page, not wrap every screen in the app.
 */
interface RootLayoutProps {
  children: ReactElement;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <Website>
      <Helmet>
        <title>PitcherML</title>
        <meta name="description" content="Pitch tracking and analytics." />
      </Helmet>
      <ScrollRestoration />
      {children}
    </Website>
  );
}
