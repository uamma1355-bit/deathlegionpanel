/**
 * Server API surface — all endpoints for server-scoped operations.
 * Mirrors docs/06-APIContract.md §5-13.
 */

import { http } from '@/api/http';

// === Files ===
export interface FileObject {
  name: string;
  mode: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
}

export async function listFiles(uuid: string, directory = '/'): Promise<{ data: FileObject[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/files/list`, { params: { directory } });
  return res.data as { data: FileObject[] };
}

export async function getFileContents(uuid: string, file: string): Promise<string> {
  const res = await http.get(`/api/client/servers/${uuid}/files/contents`, { params: { file } });
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
}

export async function saveFileContents(uuid: string, file: string, contents: string): Promise<void> {
  await http.put(`/api/client/servers/${uuid}/files/write`, contents, { params: { file }, headers: { 'Content-Type': 'text/plain' } });
}

export async function createFolder(uuid: string, root: string, name: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/create-folder`, { root, name });
}

export async function renameFiles(uuid: string, root: string, files: { from: string; to: string }[]): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/rename`, { root, files });
}

export async function deleteFiles(uuid: string, root: string, files: string[]): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/delete`, { root, files });
}

export async function compressFiles(uuid: string, root: string, files: string[]): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/compress`, { root, files });
}

export async function decompressFiles(uuid: string, root: string, file: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/decompress`, { root, file });
}

export async function copyFile(uuid: string, location: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/files/copy`, { location });
}

export async function getFileDownloadUrl(uuid: string, file: string): Promise<string> {
  const res = await http.get(`/api/client/servers/${uuid}/files/download`, { params: { file } });
  const data = res.data as { attributes?: { url?: string } };
  return data.attributes?.url ?? '';
}

export async function getFileUploadUrl(uuid: string): Promise<string> {
  const res = await http.get(`/api/client/servers/${uuid}/files/upload`);
  const data = res.data as { attributes?: { url?: string } };
  return data.attributes?.url ?? '';
}

// === Backups ===
export interface Backup {
  uuid: string;
  name: string;
  bytes: number;
  is_successful: boolean;
  is_locked: boolean;
  created_at: string;
}

export async function listBackups(uuid: string): Promise<{ data: Backup[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/backups`);
  return res.data as { data: Backup[] };
}

export async function createBackup(uuid: string, name?: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/backups`, { name });
}

export async function deleteBackup(uuid: string, backup: string): Promise<void> {
  await http.delete(`/api/client/servers/${uuid}/backups/${backup}`);
}

export async function getBackupDownloadUrl(uuid: string, backup: string): Promise<string> {
  const res = await http.get(`/api/client/servers/${uuid}/backups/${backup}/download`);
  const data = res.data as { attributes?: { url?: string } };
  return data.attributes?.url ?? '';
}

export async function restoreBackup(uuid: string, backup: string, truncate = false): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/backups/${backup}/restore`, { truncate });
}

export async function lockBackup(uuid: string, backup: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/backups/${backup}/lock`);
}

// === Schedules ===
export interface Schedule {
  id: number;
  name: string;
  is_active: boolean;
  is_processing: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  cron_minute: string;
  cron_hour: string;
  cron_day_of_week: string;
  cron_day_of_month: string;
  cron_month: string;
}

export async function listSchedules(uuid: string): Promise<{ data: Schedule[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/schedules`);
  return res.data as { data: Schedule[] };
}

export async function createSchedule(uuid: string, data: Partial<Schedule>): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/schedules`, data);
}

export async function deleteSchedule(uuid: string, schedule: number): Promise<void> {
  await http.delete(`/api/client/servers/${uuid}/schedules/${schedule}`);
}

export async function triggerSchedule(uuid: string, schedule: number): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/schedules/${schedule}/execute`);
}

// === Subusers ===
export interface Subuser {
  uuid: string;
  username: string;
  email: string;
  permissions: string[];
}

export async function listSubusers(uuid: string): Promise<{ data: Subuser[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/users`);
  return res.data as { data: Subuser[] };
}

export async function createSubuser(uuid: string, email: string, permissions: string[]): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/users`, { email, permissions });
}

export async function updateSubuser(uuid: string, userUuid: string, permissions: string[]): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/users/${userUuid}`, { permissions });
}

export async function deleteSubuser(uuid: string, userUuid: string): Promise<void> {
  await http.delete(`/api/client/servers/${uuid}/users/${userUuid}`);
}

// === Databases ===
export interface ServerDatabase {
  id: string;
  database: string;
  username: string;
  remote: string;
  max_connections: number;
}

export async function listDatabases(uuid: string): Promise<{ data: ServerDatabase[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/databases`);
  return res.data as { data: ServerDatabase[] };
}

export async function createDatabase(uuid: string, database: string, remote: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/databases`, { database, remote });
}

export async function deleteDatabase(uuid: string, database: string): Promise<void> {
  await http.delete(`/api/client/servers/${uuid}/databases/${database}`);
}

export async function rotateDatabasePassword(uuid: string, database: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/databases/${database}/rotate-password`);
}

// === Network / Allocations ===
export interface Allocation {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
}

export async function listAllocations(uuid: string): Promise<{ data: Allocation[] }> {
  const res = await http.get(`/api/client/servers/${uuid}/network/allocations`);
  return res.data as { data: Allocation[] };
}

export async function setAllocationNotes(uuid: string, allocation: number, notes: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/network/allocations/${allocation}`, { notes });
}

export async function setPrimaryAllocation(uuid: string, allocation: number): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/network/allocations/${allocation}`, { primary: true });
}

export async function deleteAllocation(uuid: string, allocation: number): Promise<void> {
  await http.delete(`/api/client/servers/${uuid}/network/allocations/${allocation}`);
}

// === Startup ===
export async function getStartup(uuid: string): Promise<unknown> {
  const res = await http.get(`/api/client/servers/${uuid}/startup`);
  return res.data;
}

export async function updateStartupVariable(uuid: string, key: string, value: string): Promise<void> {
  await http.put(`/api/client/servers/${uuid}/startup/variable`, { key, value });
}

// === Settings ===
export async function renameServer(uuid: string, name: string, description: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/settings/rename`, { name, description });
}

export async function reinstallServer(uuid: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/settings/reinstall`);
}

export async function setDockerImage(uuid: string, docker_image: string): Promise<void> {
  await http.post(`/api/client/servers/${uuid}/settings/docker-image`, { docker_image });
}

// === Activity ===
export async function getServerActivity(uuid: string, page = 1): Promise<unknown> {
  const res = await http.get(`/api/client/servers/${uuid}/activity`, { params: { page } });
  return res.data;
}
