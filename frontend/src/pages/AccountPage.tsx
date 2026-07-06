/**
 * Account page — Pterodactyl-style profile + settings.
 */

import { useAuth } from '@/auth/AuthProvider';
import { ContentContainer } from '@/components/AppLayout';

export function AccountPage(): JSX.Element {
  const { user } = useAuth();

  if (!user) return <></>;

  const initials = (user.username || '?').substring(0, 2).toUpperCase();

  return (
    <>
      <ContentContainer className="my-4 sm:my-10">
        {/* Profile header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600 text-xl font-bold text-white">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-medium text-neutral-100">{user.username}</h1>
            <p className="text-sm text-neutral-400">{user.email}</p>
          </div>
          {user.admin && (
            <span className="ml-2 rounded-full bg-cyan-600/20 px-3 py-1 text-xs font-medium text-cyan-300">
              Administrator
            </span>
          )}
        </div>

        {/* Account details */}
        <div className="mb-6 overflow-hidden rounded-lg bg-neutral-700/60 shadow">
          <div className="border-b border-neutral-600/50 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Account Details</h2>
          </div>
          <Row label="Username" value={user.username} />
          <Row label="Email" value={user.email} />
          <Row label="First Name" value={user.first_name || '—'} />
          <Row label="Last Name" value={user.last_name || '—'} />
          <Row label="Language" value={user.language.toUpperCase()} />
          <Row label="Admin Access" value={user.admin ? 'Yes' : 'No'} last />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-neutral-700/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
              <h3 className="font-medium text-neutral-100">API Keys</h3>
            </div>
            <p className="text-sm text-neutral-400">Manage your API access tokens for automation and integrations.</p>
          </div>
          <div className="rounded-lg bg-neutral-700/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <h3 className="font-medium text-neutral-100">Security (2FA)</h3>
            </div>
            <p className="text-sm text-neutral-400">Enable two-factor authentication to secure your account.</p>
          </div>
          <div className="rounded-lg bg-neutral-700/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z M9 9h6v6H9z" /></svg>
              <h3 className="font-medium text-neutral-100">SSH Keys</h3>
            </div>
            <p className="text-sm text-neutral-400">Add SSH public keys for SFTP access to your servers.</p>
          </div>
          <div className="rounded-lg bg-neutral-700/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              <h3 className="font-medium text-neutral-100">Activity Log</h3>
            </div>
            <p className="text-sm text-neutral-400">View recent activity on your account.</p>
          </div>
        </div>
      </ContentContainer>

      <ContentContainer className="mb-4">
        <p className="text-center text-xs text-neutral-500">
          <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank" className="no-underline text-neutral-500 hover:text-neutral-300">
            Pterodactyl&reg;
          </a>
          &nbsp;&copy; 2015 - {new Date().getFullYear()}
        </p>
      </ContentContainer>
    </>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }): JSX.Element {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-neutral-600/50'}`}>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-100">{value}</dd>
    </div>
  );
}
