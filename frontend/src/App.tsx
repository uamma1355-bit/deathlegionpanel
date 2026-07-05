/**
 * Top-level app shell. Routes are declared here so the structure is
 * easy to audit at a glance.
 *
 * Auth routes (/auth/*) — public, rendered inside <AuthLayout>.
 * Dashboard routes (/) — authenticated, rendered inside <AppLayout>.
 * Server routes (/server/:id/*) — authenticated, rendered inside <ServerLayout>.
 * Admin routes (/admin/*) — full page reload to backend Blade area.
 * 404 — catch-all.
 */

import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { AuthenticatedRoute } from '@/auth/PermissionRoute';
import { AppLayout, AuthLayout } from '@/components/AppLayout';
import { ServerLayout } from '@/components/ServerLayout';
import { ServerProvider } from '@/state/server-context';
import { getConfig } from '@/config/env';

import { LoginPage } from '@/pages/auth/LoginPage';
import { LoginCheckpointPage } from '@/pages/auth/LoginCheckpointPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AccountPage } from '@/pages/AccountPage';
import { ServerConsolePage } from '@/pages/server/ServerConsolePage';
import { ServerPlaceholderPage } from '@/pages/server/ServerPlaceholderPage';

export function App(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();

  // When the user logs out, redirect to /auth/login.
  useEffect(() => {
    if (user === null && window.location.pathname.startsWith('/dashboard') || window.location.pathname === '/') {
      // The <AuthenticatedRoute> handles the redirect; this effect is a no-op safety net.
    }
  }, [user, navigate]);

  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="login/checkpoint" element={<LoginCheckpointPage />} />
        <Route path="password" element={<ForgotPasswordPage />} />
        <Route path="password/reset/:token" element={<ResetPasswordPage />} />
      </Route>

      {/* Dashboard */}
      <Route
        path="/"
        element={
          <AuthenticatedRoute>
            <AppLayout />
          </AuthenticatedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>

      {/* Server (per-server sub-pages) */}
      <Route
        path="/server/:id"
        element={
          <AuthenticatedRoute>
            <ServerProvider>
              <ServerLayout />
            </ServerProvider>
          </AuthenticatedRoute>
        }
      >
        <Route index element={<ServerConsolePage />} />
        <Route path="files" element={<ServerPlaceholderPage title="Files" />} />
        <Route path="backups" element={<ServerPlaceholderPage title="Backups" />} />
        <Route path="schedules" element={<ServerPlaceholderPage title="Schedules" />} />
        <Route path="users" element={<ServerPlaceholderPage title="Subusers" />} />
        <Route path="databases" element={<ServerPlaceholderPage title="Databases" />} />
        <Route path="network" element={<ServerPlaceholderPage title="Network" />} />
        <Route path="startup" element={<ServerPlaceholderPage title="Startup" />} />
        <Route path="settings" element={<ServerPlaceholderPage title="Settings" />} />
        <Route path="activity" element={<ServerPlaceholderPage title="Activity" />} />
      </Route>

      {/* Admin — full page reload to the backend Blade area. */}
      <Route path="/admin/*" element={<AdminRedirect />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminRedirect(): null {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.href = `${getConfig().apiUrl}/admin${window.location.pathname.replace(/^\/admin/, '')}${window.location.search}`;
    }
  }, []);
  return null;
}
