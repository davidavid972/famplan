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
const FAMILY_FILE = 'family.json';

export interface FamilyData {
  familyId: string;
  familyDisplayName: string;
  familyPhoto?: string | null;
  createdAt: string;
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
 * @returns File id
 */
export async function driveWriteJson<T extends object>(
  fileId: string | null,
  json: T,
  parentId?: string
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
  const metadata = { name: FAMILY_FILE, mimeType: JSON_MIME, parents: [parentId] };
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

/**
 * Ensure FamPlan folder structure and return folder ids.
 */
export async function driveEnsureFamPlanStructure(): Promise<{ rootFolderId: string; dataFolderId: string }> {
  const rootFolderId = await driveEnsureFolder(FAMPLAN_ROOT, 'root');
  const dataFolderId = await driveEnsureFolder(DATA_FOLDER, rootFolderId);
  return { rootFolderId, dataFolderId };
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
