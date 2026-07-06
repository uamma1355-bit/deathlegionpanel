/**
 * Top-level app shell with all routes.
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthenticatedRoute } from '@/auth/PermissionRoute';
import { AppLayout, AuthLayout } from '@/components/AppLayout';
import { ServerLayout } from '@/components/ServerLayout';
import { ServerProvider } from '@/state/server-context';

import { LoginPage } from '@/pages/auth/LoginPage';
import { LoginCheckpointPage } from '@/pages/auth/LoginCheckpointPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AccountPage } from '@/pages/AccountPage';
import { ServerConsolePage } from '@/pages/server/ServerConsolePage';
import { ServerFilesPage } from '@/pages/server/ServerFilesPage';
import { ServerBackupsPage } from '@/pages/server/ServerBackupsPage';
import { ServerSchedulesPage } from '@/pages/server/ServerSchedulesPage';
import { ServerSubusersPage } from '@/pages/server/ServerSubusersPage';
import { ServerDatabasesPage } from '@/pages/server/ServerDatabasesPage';
import { ServerNetworkPage } from '@/pages/server/ServerNetworkPage';
import { ServerStartupPage } from '@/pages/server/ServerStartupPage';
import { ServerSettingsPage } from '@/pages/server/ServerSettingsPage';
import { ServerActivityPage } from '@/pages/server/ServerActivityPage';

export function App(): JSX.Element {
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
        <Route path="files" element={<ServerFilesPage />} />
        <Route path="backups" element={<ServerBackupsPage />} />
        <Route path="schedules" element={<ServerSchedulesPage />} />
        <Route path="users" element={<ServerSubusersPage />} />
        <Route path="databases" element={<ServerDatabasesPage />} />
        <Route path="network" element={<ServerNetworkPage />} />
        <Route path="startup" element={<ServerStartupPage />} />
        <Route path="settings" element={<ServerSettingsPage />} />
        <Route path="activity" element={<ServerActivityPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
