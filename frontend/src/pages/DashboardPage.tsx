/**
 * Dashboard page — Pterodactyl-style server list.
 *
 * Verbatim visual structure from upstream DashboardContainer + ServerRow:
 *  - PageContentBlock wrapper with title "Dashboard"
 *  - ServerRow cards: bg-neutral-700/60 rounded p-4 with hover effect,
 *    status bar on the right, server icon + name + description + resource
 *    icons (CPU/Memory/Disk).
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getServers } from '@/api/server/getServer';
import { Loading } from '@/components/Loading';
import { ContentContainer } from '@/components/ContentContainer';

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ['servers'], queryFn: getServers });

  return (
    <>
      <ContentContainer className="my-4 sm:my-10">
        <h1 className="mb-4 text-2xl font-medium text-neutral-100">{t('dashboard.title')}</h1>

        {isLoading && <Loading centered label={t('dashboard.loading')} />}

        {error && (
          <div className="rounded border border-red-700 bg-red-900/40 p-4 text-sm text-red-200">
            {error instanceof Error ? error.message : t('common.error')}
          </div>
        )}

        {data && data.data.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-400">
            There are no servers associated with your account.
          </p>
        )}

        {data && data.data.length > 0 && (
          <div className="space-y-2">
            {data.data.map((s) => {
              const a = s.attributes;
              return (
                <Link
                  key={a.uuid}
                  to={`/server/${a.identifier}`}
                  className="group relative block overflow-hidden rounded bg-neutral-700/60 p-4 transition-all duration-150 hover:bg-neutral-700"
                >
                  {/* status bar (right edge) — verbatim from upstream ServerRow */}
                  <span
                    className={`absolute right-0 z-20 m-1 w-2 rounded-full transition-all duration-150 group-hover:opacity-75 ${
                      !a.status || a.status === 'offline'
                        ? 'bg-red-500'
                        : a.status === 'running'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                    }`}
                    style={{ height: 'calc(100% - 0.5rem)' }}
                  />

                  <div className="grid grid-cols-12 gap-4">
                    {/* Server icon + name/description */}
                    <div className="col-span-12 flex items-center gap-3 sm:col-span-5">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-neutral-800">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-400" fill="currentColor" aria-hidden>
                          <path d="M4 5h16a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm0 8h16a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a1 1 0 011-1zm2-6v1h2V7H6zm0 8v1h2v-1H6z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-header text-lg text-gray-50">{a.name}</h2>
                        <p className="truncate text-xs text-neutral-400">
                          {a.container.image}
                        </p>
                      </div>
                    </div>

                    {/* Resource stats */}
                    <div className="col-span-12 grid grid-cols-3 gap-3 sm:col-span-7 sm:items-center">
                      <ResourceStat
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                            <path d="M9 2v2H7v6H5v2h14v-2h-2V4h-2V2H9zm0 12c-1.1 0-2 .9-2 2v6h10v-6c0-1.1-.9-2-2-2H9z" />
                          </svg>
                        }
                        label="CPU"
                        value={`${a.limits.cpu}%`}
                      />
                      <ResourceStat
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                            <path d="M3 7h18v10H3V7zm2 2v6h14V9H5z" />
                          </svg>
                        }
                        label="Memory"
                        value={`${a.limits.memory} MB`}
                      />
                      <ResourceStat
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                            <path d="M10 2h4l1 2h4v18H5V4h4l1-2zm1 6l-3 5h2v4l3-5h-2V8z" />
                          </svg>
                        }
                        label="Disk"
                        value={`${a.limits.disk} MB`}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </ContentContainer>

      <ContentContainer className="mb-4">
        <p className="text-center text-xs text-neutral-500">
          <a
            rel="noopener nofollow noreferrer"
            href="https://pterodactyl.io"
            target="_blank"
            className="no-underline text-neutral-500 hover:text-neutral-300"
          >
            Pterodactyl&reg;
          </a>
          &nbsp;&copy; 2015 - {new Date().getFullYear()}
        </p>
      </ContentContainer>
    </>
  );
}

function ResourceStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-400">{icon}</span>
      <div>
        <p className="text-2xs uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="text-sm text-neutral-300">{value}</p>
      </div>
    </div>
  );
}
