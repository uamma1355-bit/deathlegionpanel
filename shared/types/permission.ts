/**
 * 35 subuser permission constants across 10 categories.
 * Source: app/Models/Permission.php (upstream v1.11.3).
 */

export const PERMISSION = {
  CONTROL_CONSOLE: 'control.console',
  CONTROL_START: 'control.start',
  CONTROL_STOP: 'control.stop',
  CONTROL_RESTART: 'control.restart',

  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  FILE_READ: 'file.read',
  FILE_CREATE: 'file.create',
  FILE_UPDATE: 'file.update',
  FILE_DELETE: 'file.delete',
  FILE_ARCHIVE: 'file.archive',
  FILE_SFTP: 'file.sftp',

  BACKUP_READ: 'backup.read',
  BACKUP_CREATE: 'backup.create',
  BACKUP_UPDATE: 'backup.update',
  BACKUP_DELETE: 'backup.delete',
  BACKUP_DOWNLOAD: 'backup.download',
  BACKUP_RESTORE: 'backup.restore',

  ALLOCATION_READ: 'allocation.read',
  ALLOCATION_CREATE: 'allocation.create',
  ALLOCATION_UPDATE: 'allocation.update',
  ALLOCATION_DELETE: 'allocation.delete',

  STARTUP_READ: 'startup.read',
  STARTUP_UPDATE: 'startup.update',

  DATABASE_READ: 'database.read',
  DATABASE_CREATE: 'database.create',
  DATABASE_UPDATE: 'database.update',
  DATABASE_DELETE: 'database.delete',

  SCHEDULE_READ: 'schedule.read',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_RENAME: 'settings.rename',
  SETTINGS_REINSTALL: 'settings.reinstall',

  ACTIVITY_READ: 'activity.read',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  control: [
    PERMISSION.CONTROL_CONSOLE,
    PERMISSION.CONTROL_START,
    PERMISSION.CONTROL_STOP,
    PERMISSION.CONTROL_RESTART,
  ],
  user: [PERMISSION.USER_READ, PERMISSION.USER_CREATE, PERMISSION.USER_UPDATE, PERMISSION.USER_DELETE],
  file: [
    PERMISSION.FILE_READ,
    PERMISSION.FILE_CREATE,
    PERMISSION.FILE_UPDATE,
    PERMISSION.FILE_DELETE,
    PERMISSION.FILE_ARCHIVE,
    PERMISSION.FILE_SFTP,
  ],
  backup: [
    PERMISSION.BACKUP_READ,
    PERMISSION.BACKUP_CREATE,
    PERMISSION.BACKUP_UPDATE,
    PERMISSION.BACKUP_DELETE,
    PERMISSION.BACKUP_DOWNLOAD,
    PERMISSION.BACKUP_RESTORE,
  ],
  allocation: [
    PERMISSION.ALLOCATION_READ,
    PERMISSION.ALLOCATION_CREATE,
    PERMISSION.ALLOCATION_UPDATE,
    PERMISSION.ALLOCATION_DELETE,
  ],
  startup: [PERMISSION.STARTUP_READ, PERMISSION.STARTUP_UPDATE],
  database: [
    PERMISSION.DATABASE_READ,
    PERMISSION.DATABASE_CREATE,
    PERMISSION.DATABASE_UPDATE,
    PERMISSION.DATABASE_DELETE,
  ],
  schedule: [
    PERMISSION.SCHEDULE_READ,
    PERMISSION.SCHEDULE_CREATE,
    PERMISSION.SCHEDULE_UPDATE,
    PERMISSION.SCHEDULE_DELETE,
  ],
  settings: [PERMISSION.SETTINGS_VIEW, PERMISSION.SETTINGS_RENAME, PERMISSION.SETTINGS_REINSTALL],
  activity: [PERMISSION.ACTIVITY_READ],
};

export function hasPermission(permissions: string[] | undefined | null, required: Permission): boolean {
  if (!permissions) return false;
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: string[] | undefined | null, required: Permission[]): boolean {
  if (!permissions || required.length === 0) return false;
  return required.some((p) => permissions.includes(p));
}
