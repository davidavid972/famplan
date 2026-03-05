/**
 * Google Drive API helper - frontend only, uses drive.file scope.
 * Requires valid access token from googleAuth.
 */

import { getStoredAccessToken } from './googleAuth';
import { v4 as uuidv4 } from 'uuid';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';

const FAMPLAN_ROOT = 'FamPlan';
const DATA_FOLDER = 'data';
const ATTACHMENTS_FOLDER = 'attachments';
const PEOPLE_PHOTOS_FOLDER = 'people_photos';
const FAMILY_FILE = 'family.json';
const PEOPLE_FILE = 'people.json';
const APPOINTMENTS_FILE = 'appointments.json';
const ATTACHMENTS_INDEX_FILE = 'attachments_index.json';
const USERS_FILE = 'users.json';

export interface FamilyData {
  familyId: string;
  familyDisplayName: string;
  familyPhoto?: string | null;
  createdAt: string;
  /** Chosen FamPlan calendar ID when multiple exist */
  calendarId?: string | null;
  /** UI preferences */
  ui?: {
    selectionColor?: string | null;
    planFilterPersonIds?: string[] | null;
  };
}

function getAuthHeader(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

async function driveRequest<T>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { ...getAuthHeader(), ...opts.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API error: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Ensure a folder exists. Create if not found.
 * @param name Folder name
 * @param parentId Parent folder id, or 'root' for Drive root
 * @returns Folder id
 */
export async function driveEnsureFolder(name: string, parentId: string = 'root'): Promise<string> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const list = await driveRequest<{ files: { id: string }[] }>(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`
  );
  if (list.files?.length > 0) return list.files[0].id;

  const create = await driveRequest<{ id: string }>(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
  return create.id;
}

/**
 * Find a file by name in a folder.
 * @param name File name
 * @param parentId Parent folder id
 * @returns File id or null if not found
 */
export async function driveFindFile(name: string, parentId: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const list = await driveRequest<{ files: { id: string }[] }>(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`
  );
  return list.files?.[0]?.id ?? null;
}

/**
 * Read JSON file content.
 */
export async function driveReadJson<T>(fileId: string): Promise<T> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
  return res.json();
}

/**
 * Create or update a JSON file.
 * @param fileId Existing file id, or null to create new
 * @param json Data to write
 * @param parentId Parent folder (required when creating)
 * @param fileName File name when creating (default: family.json)
 * @returns File id
 */
export async function driveWriteJson<T extends object>(
  fileId: string | null,
  json: T,
  parentId?: string,
  fileName: string = FAMILY_FILE
): Promise<string> {
  const body = JSON.stringify(json);
  const blob = new Blob([body], { type: JSON_MIME });

  if (fileId) {
    const res = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...getAuthHeader(), 'Content-Type': JSON_MIME },
      body: blob,
    });
    if (!res.ok) throw new Error(`Failed to update file: ${res.status}`);
    return fileId;
  }

  if (!parentId) throw new Error('parentId required when creating file');
  const metadata = { name: fileName, mimeType: JSON_MIME, parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const headers = getAuthHeader();
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) throw new Error(`Failed to create file: ${res.status}`);
  const data = await res.json();
  return data.id;
}

const PERSON_PHOTO_URL_CACHE = new Map<string, string>();

/**
 * Upload a person photo to FamPlan/people_photos/.
 * @returns Drive file id
 */
export async function driveUploadPersonPhoto(
  file: File,
  personId: string,
  peoplePhotosFolderId: string
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const mime = file.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
  const fileName = `${personId}.${ext}`;

  const metadata = {
    name: fileName,
    mimeType: mime,
    parents: [peoplePhotosFolderId],
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(`Failed to upload person photo: ${res.status}`);
  const data = await res.json();
  return data.id;
}

/**
 * Get a displayable URL for a person photo (fetches from Drive, caches blob URL).
 */
export async function driveGetPersonPhotoUrl(fileId: string): Promise<string> {
  const cached = PERSON_PHOTO_URL_CACHE.get(fileId);
  if (cached) return cached;

  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error(`Failed to load person photo: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  PERSON_PHOTO_URL_CACHE.set(fileId, url);
  return url;
}

/** People.json schema */
export interface PeopleData {
  version: number;
  updatedAt: string;
  people: Array<{ id: string; name: string; color: string; createdAt: number; photoFileId?: string | null }>;
}

/** Appointments.json schema */
export interface AppointmentsData {
  version: number;
  updatedAt: string;
  appointments: Array<{
    id: string;
    personId: string;
    title: string;
    start: number;
    end: number;
    location?: string;
    notes?: string;
    status: string;
    reminders?: { minutesBeforeStart: number }[];
    createdAt: number;
    calendarEventId?: string;
  }>;
}

/** Attachments index schema */
export interface AttachmentsIndexData {
  version: number;
  updatedAt: string;
  items: Array<{
    id: string;
    appointmentId: string;
    name: string;
    type: string;
    size: number;
    createdAt: number;
    uploaderId: string;
  }>;
  freeLimit: number;
}

/** users.json schema - roles for family sharing */
export type UserRoleType = 'admin' | 'editor' | 'viewer';
export interface UsersDataMember {
  email: string;
  role: UserRoleType;
  addedAt: string;
  permissionId?: string;
}
export interface UsersData {
  version: number;
  updatedAt: string;
  members: UsersDataMember[];
}

function createEmptyPeopleData(): PeopleData {
  return { version: 1, updatedAt: new Date().toISOString(), people: [] };
}

function createEmptyAppointmentsData(): AppointmentsData {
  return { version: 1, updatedAt: new Date().toISOString(), appointments: [] };
}

function createEmptyAttachmentsIndexData(): AttachmentsIndexData {
  return { version: 1, updatedAt: new Date().toISOString(), items: [], freeLimit: 20 };
}

function createEmptyUsersData(): UsersData {
  return { version: 1, updatedAt: new Date().toISOString(), members: [] };
}

/**
 * Load or create a data file. Does NOT overwrite existing content.
 */
export async function driveLoadOrCreateDataFile<T extends object>(
  dataFolderId: string,
  fileName: string,
  createDefault: () => T,
  cachedFileId?: string | null
): Promise<{ data: T; fileId: string }> {
  let fileId = cachedFileId || (await driveFindFile(fileName, dataFolderId));
  if (fileId) {
    try {
      const data = await driveReadJson<T>(fileId);
      return { data, fileId };
    } catch {
      fileId = await driveFindFile(fileName, dataFolderId);
    }
  }
  const defaultData = createDefault();
  const newFileId = await driveWriteJson(null, defaultData, dataFolderId, fileName);
  return { data: defaultData, fileId: newFileId };
}

export async function driveLoadPeople(dataFolderId: string, cachedFileId?: string | null): Promise<{ data: PeopleData; fileId: string }> {
  return driveLoadOrCreateDataFile(dataFolderId, PEOPLE_FILE, createEmptyPeopleData, cachedFileId);
}

export async function driveLoadAppointments(dataFolderId: string, cachedFileId?: string | null): Promise<{ data: AppointmentsData; fileId: string }> {
  return driveLoadOrCreateDataFile(dataFolderId, APPOINTMENTS_FILE, createEmptyAppointmentsData, cachedFileId);
}

export async function driveLoadAttachmentsIndex(dataFolderId: string, cachedFileId?: string | null): Promise<{ data: AttachmentsIndexData; fileId: string }> {
  return driveLoadOrCreateDataFile(dataFolderId, ATTACHMENTS_INDEX_FILE, createEmptyAttachmentsIndexData, cachedFileId);
}

export async function driveLoadUsers(dataFolderId: string, cachedFileId?: string | null): Promise<{ data: UsersData; fileId: string }> {
  return driveLoadOrCreateDataFile(dataFolderId, USERS_FILE, createEmptyUsersData, cachedFileId);
}

export async function driveWriteUsers(fileId: string, data: UsersData): Promise<string> {
  await driveWriteJson(fileId, data, undefined, USERS_FILE);
  return fileId;
}

/** Drive role: reader = Viewer, writer = Editor. Admin is FamPlan-specific (stored in users.json only). */
export type DrivePermissionRole = 'reader' | 'writer';

/**
 * Create a permission on a file/folder for a user by email.
 * @returns The permission id (store for removal)
 */
export async function driveCreatePermission(
  fileId: string,
  emailAddress: string,
  role: DrivePermissionRole
): Promise<{ id: string }> {
  const res = await driveRequest<{ id: string }>(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'user',
      role,
      emailAddress,
    }),
  });
  return res;
}

/**
 * Update a permission's role.
 */
export async function driveUpdatePermission(fileId: string, permissionId: string, role: DrivePermissionRole): Promise<void> {
  await driveRequest(`${DRIVE_API}/files/${fileId}/permissions/${permissionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

/**
 * Delete a permission by id.
 */
export async function driveDeletePermission(fileId: string, permissionId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions/${permissionId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive delete permission: ${res.status} ${err}`);
  }
}

/**
 * List permissions on a file (for finding permissionId by email if needed).
 */
export async function driveListPermissions(fileId: string): Promise<Array<{ id: string; type: string; role: string; emailAddress?: string }>> {
  const res = await driveRequest<{ permissions: Array<{ id: string; type: string; role: string; emailAddress?: string }> }>(
    `${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type,role,emailAddress)`
  );
  return res.permissions ?? [];
}

/**
 * Search for FamPlan folders shared with the current user.
 */
async function driveFindSharedFamPlanFolders(): Promise<Array<{ id: string }>> {
  const q = `sharedWithMe = true and name = '${FAMPLAN_ROOT.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const list = await driveRequest<{ files: { id: string }[] }>(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`
  );
  return list.files ?? [];
}

/**
 * Check if a FamPlan root folder has the data/family.json structure.
 */
async function driveFolderHasFamilyJson(rootFolderId: string): Promise<boolean> {
  const dataFolderId = await driveFindFile(DATA_FOLDER, rootFolderId);
  if (!dataFolderId) return false;
  const familyFileId = await driveFindFile(FAMILY_FILE, dataFolderId);
  return !!familyFileId;
}

/**
 * Resolve FamPlan root folder: shared first, then own, then create new.
 * @param cachedRootFolderId Optional cached folder id - validated before use
 */
export async function driveResolveFamPlanFolder(cachedRootFolderId?: string | null): Promise<string> {
  if (cachedRootFolderId) {
    try {
      await driveRequest<{ id: string }>(`${DRIVE_API}/files/${cachedRootFolderId}?fields=id`);
      return cachedRootFolderId;
    } catch {
      // Cache invalid (404/403) - clear and resolve fresh
    }
  }

  const shared = await driveFindSharedFamPlanFolders();
  if (shared.length > 0) {
    const withFamily = await Promise.all(
      shared.map(async (f) => ({ id: f.id, hasFamily: await driveFolderHasFamilyJson(f.id) }))
    );
    const preferred = withFamily.find((x) => x.hasFamily) ?? withFamily[0];
    return preferred.id;
  }

  const ownQ = `name='${FAMPLAN_ROOT.replace(/'/g, "\\'")}' and 'root' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const ownList = await driveRequest<{ files: { id: string }[] }>(
    `${DRIVE_API}/files?q=${encodeURIComponent(ownQ)}&fields=files(id)`
  );
  if (ownList.files?.length) return ownList.files[0].id;

  return driveEnsureFolder(FAMPLAN_ROOT, 'root');
}

/**
 * Ensure FamPlan folder structure and return folder ids.
 * Resolves root: shared first, then own, then create. Uses cache when valid.
 */
export async function driveEnsureFamPlanStructure(cachedRootFolderId?: string | null): Promise<{ rootFolderId: string; dataFolderId: string; attachmentsFolderId: string; peoplePhotosFolderId: string }> {
  const rootFolderId = await driveResolveFamPlanFolder(cachedRootFolderId);
  const dataFolderId = await driveEnsureFolder(DATA_FOLDER, rootFolderId);
  const attachmentsFolderId = await driveEnsureFolder(ATTACHMENTS_FOLDER, rootFolderId);
  const peoplePhotosFolderId = await driveEnsureFolder(PEOPLE_PHOTOS_FOLDER, rootFolderId);
  return { rootFolderId, dataFolderId, attachmentsFolderId, peoplePhotosFolderId };
}

/**
 * Load family.json from Drive. Create with defaults if missing.
 */
export async function driveLoadFamily(dataFolderId: string): Promise<{ data: FamilyData; fileId: string }> {
  const fileId = await driveFindFile(FAMILY_FILE, dataFolderId);
  if (fileId) {
    const data = await driveReadJson<FamilyData>(fileId);
    return { data, fileId };
  }
  const familyId = uuidv4();
  const data: FamilyData = {
    familyId,
    familyDisplayName: '',
    createdAt: new Date().toISOString(),
  };
  const newFileId = await driveWriteJson(null, data, dataFolderId);
  return { data, fileId: newFileId };
}
