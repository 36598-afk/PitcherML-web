import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import HomePage from './pages/index';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import PitchAnalysisPage from './pages/pitch-analysis';
import StrikeZonePage from './pages/strike-zone';
import ProdNotFoundPage from './pages/_404';
import { ProtectedRoute } from './lib/auth/auth-client';

const PlayersPage = lazy(() => import('./pages/players/index'));
const DashboardPage = lazy(() => import('./pages/dashboard'));
const PitchAnalysisResultPage = lazy(() => import('./pages/pitch-analysis/[id]'));
const SessionCalibratePage = lazy(() => import('./pages/session/calibrate'));
const ActiveSessionPage = lazy(() => import('./pages/session/active'));
const SessionReportPage = lazy(() => import('./pages/session/report'));

const NotFoundPage = ProdNotFoundPage;

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/pitch-analysis',
    element: <ProtectedRoute><PitchAnalysisPage /></ProtectedRoute>,
  },
  {
    path: '/pitch-analysis/:id',
    element: <ProtectedRoute><PitchAnalysisResultPage /></ProtectedRoute>,
  },
  {
    path: '/session/:sessionId/calibrate',
    element: <ProtectedRoute><SessionCalibratePage /></ProtectedRoute>,
  },
  {
    path: '/session/:sessionId/report',
    element: <ProtectedRoute><SessionReportPage /></ProtectedRoute>,
  },
  {
    path: '/session/:sessionId',
    element: <ProtectedRoute><ActiveSessionPage /></ProtectedRoute>,
  },
  {
    path: '/strike-zone',
    element: <ProtectedRoute><StrikeZonePage /></ProtectedRoute>,
  },
  {
    path: '/players',
    element: (
      <ProtectedRoute>
        <PlayersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export type Path = '/' | '/login' | '/signup' | '/players' | '/dashboard';
export type Params = Record<string, string | undefined>;
