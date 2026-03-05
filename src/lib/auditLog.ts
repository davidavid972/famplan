/**
 * Audit log: FamPlan/data/audit_log.json
 * Stores activity log entries for people, appointments, etc.
 */

import { driveFindFile, driveReadJson, driveWriteJson } from './drive';

const AUDIT_FILE_NAME = 'audit_log.json';

export interface AuditLogEntry {
  ts: string;
  userEmail: string;
  action: string;
  entityId: string;
  summary: string;
}

export interface AuditLogData {
  entries: AuditLogEntry[];
}

function createEmptyAuditLog(): AuditLogData {
  return { entries: [] };
}

export async function auditLogLoad(dataFolderId: string): Promise<{ data: AuditLogData; fileId: string }> {
  const fileId = await driveFindFile(AUDIT_LOG_FILE, dataFolderId);
  if (fileId) {
    const data = await driveReadJson<AuditLogData>(fileId);
    return { data: { entries: Array.isArray(data?.entries) ? data.entries : [] }, fileId };
  }
  const defaultData = createEmptyAuditLog();
  const newFileId = await driveWriteJson(null, defaultData, dataFolderId, AUDIT_FILE_NAME);
  return { data: defaultData, fileId: newFileId };
}

export async function auditLogAppend(
  dataFolderId: string,
  fileId: string | null,
  entry: AuditLogEntry
): Promise<string> {
  let data: AuditLogData;
  let fid = fileId || (await driveFindFile(AUDIT_FILE_NAME, dataFolderId));
  if (fid) {
    try {
      const loaded = await driveReadJson<AuditLogData>(fid);
      data = { entries: Array.isArray(loaded?.entries) ? loaded.entries : [] };
    } catch {
      data = createEmptyAuditLog();
    }
  } else {
    data = createEmptyAuditLog();
  }
  data.entries.push(entry);
  if (data.entries.length > 500) {
    data.entries = data.entries.slice(-400);
  }
  fid = await driveWriteJson(fid, data, dataFolderId, AUDIT_FILE_NAME);
  return fid;
}
