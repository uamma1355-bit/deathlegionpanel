/**
 * Account page — Pterodactyl-style.
 *
 * Uses the ContentContainer + a card-style list of fields, matching
 * upstream's account overview layout.
 */

import { useAuth } from '@/auth/AuthProvider';
import { useTranslation } from 'react-i18next';
import { ContentContainer } from '@/components/ContentContainer';

export function AccountPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return <></>;

  return (
    <>
      <ContentContainer className="my-4 sm:my-10">
        <h1 className="mb-4 text-2xl font-medium text-neutral-100">{t('nav.account')}</h1>

        <div className="overflow-hidden rounded-lg bg-neutral-700/60 shadow">
          <Row label="Username" value={user.username} />
          <Row label="Email" value={user.email} />
          <Row label="First name" value={user.first_name || '—'} />
          <Row label="Last name" value={user.last_name || '—'} />
          <Row label="Language" value={user.language} />
          <Row label="Root admin" value={user.admin ? 'Yes' : 'No'} />
          <Row label="2FA enabled" value="Configure in account settings" />
          <Row label="User ID" value={user.id.toString()} mono last />
        </div>
      </ContentContainer>
    </>
  );
}

function Row({ label, value, mono = false, last = false }: { label: string; value: string; mono?: boolean; last?: boolean }): JSX.Element {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-neutral-600/50'}`}>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className={`text-sm text-neutral-100 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
