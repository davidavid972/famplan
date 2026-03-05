/**
 * V1: localStorage-only attachments (metadata only, no file bytes).
 * Structure for future Google Drive/Calendar mapping.
 */

const STORAGE_KEY = "famplan_attachments_local";
const MAX_FAMILY_ATTACHMENTS = 20;

export interface LocalAttachmentRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  planId: string;
  uploader: string;
}

interface LocalAttachmentsStore {
  attachments: LocalAttachmentRecord[];
}

function loadStore(): LocalAttachmentsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalAttachmentsStore;
      if (parsed?.attachments && Array.isArray(parsed.attachments)) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { attachments: [] };
}

function saveStore(store: LocalAttachmentsStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getLocalAttachmentsCount(): number {
  return loadStore().attachments.length;
}

export function getRemainingLocalSlots(): number {
  const count = getLocalAttachmentsCount();
  return Math.max(0, MAX_FAMILY_ATTACHMENTS - count);
}

export function listLocalAttachmentsByPlan(planId: string): LocalAttachmentRecord[] {
  return loadStore().attachments.filter((a) => a.planId === planId);
}

export function addLocalAttachments(
  planId: string,
  items: Array<{ name: string; type: string; size: number }>,
  uploader = "u_local"
): LocalAttachmentRecord[] {
  const store = loadStore();
  const remaining = MAX_FAMILY_ATTACHMENTS - store.attachments.length;
  if (items.length > remaining) {
    const e = new Error("ATT_LIMIT_REACHED") as Error & { code?: string };
    e.code = "ATT_LIMIT_REACHED";
    throw e;
  }
  const now = new Date().toISOString();
  const newRecords: LocalAttachmentRecord[] = items.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    type: item.type,
    size: item.size,
    createdAt: now,
    planId,
    uploader,
  }));
  store.attachments.push(...newRecords);
  saveStore(store);
  return newRecords;
}

export function removeLocalAttachment(id: string): void {
  const store = loadStore();
  store.attachments = store.attachments.filter((a) => a.id !== id);
  saveStore(store);
}

export function removeLocalAttachmentsBulk(ids: string[]): number {
  const idSet = new Set(ids);
  const store = loadStore();
  const before = store.attachments.length;
  store.attachments = store.attachments.filter((a) => !idSet.has(a.id));
  saveStore(store);
  return before - store.attachments.length;
}

export function deleteLocalAttachmentsByPlan(planId: string): number {
  const store = loadStore();
  const before = store.attachments.length;
  store.attachments = store.attachments.filter((a) => a.planId !== planId);
  saveStore(store);
  return before - store.attachments.length;
}

export const MAX_FAMILY_ATTACHMENTS_LOCAL = MAX_FAMILY_ATTACHMENTS;
