/**
 * Admin Panel — Pterodactyl-style admin dashboard.
 * Shows all users, all servers, nodes, and system stats.
 * Uses the Application API (ptla_ token) for admin data.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/api/http';
import { ContentContainer } from '@/components/AppLayout';
import { PterodactylIcon } from '@/components/PterodactylLogo';
import { useAuth } from '@/auth/AuthProvider';

interface AdminUser {
  id: number; uuid: string; username: string; email: string;
  first_name: string; last_name: string; root_admin: boolean;
  '2fa': boolean; created_at: string;
}
interface AdminServer {
  id: number; uuid: string; name: string; description: string;
  limits: { memory: number; disk: number; cpu: number };
  node: number; owner_id: number; status: string | null;
}
interface AdminNode {
  id: number; uuid: string; name: string; fqdn: string;
  memory: number; disk: number; location_id: number;
}

type Tab = 'overview' | 'servers' | 'users' | 'nodes';

export function AdminPage(): JSX.Element {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  if (!user?.admin) {
    return (
      <ContentContainer className="my-10">
        <div className="rounded border border-red-700 bg-red-900/40 p-6 text-center">
          <h1 className="text-xl text-red-200">Access Denied</h1>
          <p className="mt-2 text-sm text-red-300">You need administrator privileges.</p>
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className="my-4 sm:my-10">
      <div className="mb-6 flex items-center gap-3">
        <PterodactylIcon className="h-10 w-10" />
        <div>
          <h1 className="text-2xl font-medium text-neutral-100">Admin Panel</h1>
          <p className="text-sm text-neutral-400">Manage all users, servers, and nodes</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-700">
        {(['overview', 'servers', 'users', 'nodes'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-b-2 border-cyan-500 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'servers' && <ServersTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'nodes' && <NodesTab />}
    </ContentContainer>
  );
}

function OverviewTab(): JSX.Element {
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });
  const { data: servers } = useQuery({ queryKey: ['admin-servers'], queryFn: fetchServers });
  const { data: nodes } = useQuery({ queryKey: ['admin-nodes'], queryFn: fetchNodes });

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Users" value={users?.length ?? 0} icon="👥" color="text-cyan-400" />
        <StatCard label="Servers" value={servers?.length ?? 0} icon="🖥️" color="text-green-400" />
        <StatCard label="Nodes" value={nodes?.length ?? 0} icon="📍" color="text-blue-400" />
        <StatCard label="Admins" value={users?.filter((u) => u.root_admin).length ?? 0} icon="⚡" color="text-yellow-400" />
      </div>
      <h2 className="mb-3 text-lg font-medium text-neutral-100">Recent Servers</h2>
      <div className="space-y-2">
        {servers?.slice(0, 5).map((s) => (
          <div key={s.uuid} className="flex items-center justify-between rounded bg-neutral-700/60 p-3">
            <div>
              <p className="font-medium text-neutral-100">{s.name}</p>
              <p className="text-xs text-neutral-400">{s.description || 'No description'}</p>
            </div>
            <div className="text-right text-xs text-neutral-400">
              <p>CPU: {s.limits?.cpu ?? 0}%</p>
              <p>RAM: {s.limits?.memory ?? 0}MB</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServersTab(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['admin-servers'], queryFn: fetchServers });
  if (isLoading) return <p className="text-neutral-400">Loading…</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-700">
      <table className="w-full text-sm">
        <thead className="bg-neutral-800 text-neutral-400">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Owner</th>
            <th className="px-4 py-2 text-right">CPU</th>
            <th className="px-4 py-2 text-right">RAM</th>
            <th className="px-4 py-2 text-right">Disk</th>
            <th className="px-4 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((s) => (
            <tr key={s.uuid} className="border-t border-neutral-800 hover:bg-neutral-800/50">
              <td className="px-4 py-2 text-neutral-100">{s.name}</td>
              <td className="px-4 py-2 text-neutral-400">#{s.owner_id}</td>
              <td className="px-4 py-2 text-right text-neutral-400">{s.limits?.cpu ?? 0}%</td>
              <td className="px-4 py-2 text-right text-neutral-400">{s.limits?.memory ?? 0}MB</td>
              <td className="px-4 py-2 text-right text-neutral-400">{s.limits?.disk ?? 0}MB</td>
              <td className="px-4 py-2 text-center">
                <span className={`rounded px-2 py-0.5 text-xs ${
                  s.status === 'running' ? 'bg-green-600/20 text-green-300' :
                  !s.status ? 'bg-red-600/20 text-red-300' : 'bg-yellow-600/20 text-yellow-300'
                }`}>{s.status ?? 'offline'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });
  if (isLoading) return <p className="text-neutral-400">Loading…</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-700">
      <table className="w-full text-sm">
        <thead className="bg-neutral-800 text-neutral-400">
          <tr>
            <th className="px-4 py-2 text-left">Username</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-center">Admin</th>
            <th className="px-4 py-2 text-center">2FA</th>
            <th className="px-4 py-2 text-right">Created</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.uuid} className="border-t border-neutral-800 hover:bg-neutral-800/50">
              <td className="px-4 py-2 text-neutral-100">{u.username}</td>
              <td className="px-4 py-2 text-neutral-400">{u.email}</td>
              <td className="px-4 py-2 text-neutral-400">{u.first_name} {u.last_name}</td>
              <td className="px-4 py-2 text-center">{u.root_admin ? <span className="rounded bg-yellow-600/20 px-2 py-0.5 text-xs text-yellow-300">Admin</span> : '—'}</td>
              <td className="px-4 py-2 text-center">{u['2fa'] ? <span className="text-green-400">✓</span> : '—'}</td>
              <td className="px-4 py-2 text-right text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NodesTab(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['admin-nodes'], queryFn: fetchNodes });
  if (isLoading) return <p className="text-neutral-400">Loading…</p>;
  return (
    <div className="space-y-3">
      {data?.map((n) => (
        <div key={n.uuid} className="rounded bg-neutral-700/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-neutral-100">{n.name}</h3>
              <p className="text-xs text-neutral-400">{n.fqdn}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-right"><p className="text-xs text-neutral-500">Memory</p><p className="text-neutral-300">{n.memory}MB</p></div>
              <div className="text-right"><p className="text-xs text-neutral-500">Disk</p><p className="text-neutral-300">{n.disk}MB</p></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }): JSX.Element {
  return (
    <div className="rounded bg-neutral-700/60 p-4">
      <div className="mb-1 flex items-center gap-2"><span className="text-lg">{icon}</span><span className="text-xs uppercase tracking-wide text-neutral-400">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await http.get('/api/application/users');
  return (res.data as { data: { attributes: AdminUser }[] }).data.map((d) => d.attributes);
}
async function fetchServers(): Promise<AdminServer[]> {
  const res = await http.get('/api/application/servers');
  return (res.data as { data: { attributes: AdminServer }[] }).data.map((d) => d.attributes);
}
async function fetchNodes(): Promise<AdminNode[]> {
  const res = await http.get('/api/application/nodes');
  return (res.data as { data: { attributes: AdminNode }[] }).data.map((d) => d.attributes);
}
