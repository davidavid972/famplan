import { useEffect, useRef, useState } from "react";
import { loadPeople, type Person } from "../lib/peopleRepo";
import {
  loadAppointments,
  addAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  type Appointment,
} from "../lib/appointmentsRepo";
import {
  loadIndex,
  addAttachment,
  removeAttachment,
  addAttachmentsBulk,
  removeAttachmentsBulk,
  deleteAppointmentAttachments,
  listAppointmentAttachments,
  type AttachmentsIndex,
  type AttachmentRecord,
  type BulkDeleteResult,
} from "../lib/attachmentsRepo";
import {
  getLocalAttachmentsCount,
  listLocalAttachmentsByPlan,
  addLocalAttachments,
  removeLocalAttachment,
  removeLocalAttachmentsBulk,
  deleteLocalAttachmentsByPlan,
  MAX_FAMILY_ATTACHMENTS_LOCAL,
  type LocalAttachmentRecord,
} from "../lib/attachmentsLocal";
import { deleteEvent } from "../lib/googleCalendar";
import ConfirmDeleteAppointmentModal from "../components/ConfirmDeleteAppointmentModal";
import { useCanEdit } from "../lib/role";
import { useFamilyBound } from "../lib/familyDiscovery";
import { getJsonCache, setJsonCache } from "../lib/cache";
import { useLanguage } from "../contexts/LanguageContext";
import { toast } from "sonner";
import { Card, Button, Badge, EmptyState } from "../components/ui";

type PageStatus = "loading" | "ready" | "adding" | "error";

type ReminderUnit = "minutes" | "hours" | "days";

interface ReminderEntry {
  value: number;
  unit: ReminderUnit;
}

function toMinutes(entry: ReminderEntry): number {
  if (entry.unit === "minutes") return entry.value;
  if (entry.unit === "hours") return entry.value * 60;
  return entry.value * 1440;
}

const STATUS_MAP: Record<string, string> = {
  "מתוכנן": "status_planned",
  "בוצע": "status_done",
  "בוטל": "status_cancelled",
};

/** Unified attachment for display (Drive or local) */
interface DisplayAttachment {
  id: string;
  fileName: string;
  driveFileId?: string;
  isLocal: boolean;
}

function toDisplayAttachment(a: AttachmentRecord): DisplayAttachment {
  return { id: a.id, fileName: a.fileName, driveFileId: a.driveFileId, isLocal: false };
}
function toDisplayAttachmentLocal(a: LocalAttachmentRecord): DisplayAttachment {
  return { id: a.id, fileName: a.name, isLocal: true };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30 - (d.getMinutes() % 15));
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── Appointment Card ── */

function AppointmentCard({
  appt,
  personName,
  attachments,
  remainingSlots,
  maxFamilyAttachments,
  canEdit,
  onDone,
  onDelete,
  onAttachmentAdded,
  onRemoveLocalAttachment,
  onRemoveLocalAttachmentsBulk,
}: {
  appt: Appointment;
  personName: string;
  attachments: DisplayAttachment[];
  remainingSlots: number;
  maxFamilyAttachments: number;
  canEdit: boolean;
  onDone: () => void;
  onDelete: () => void;
  onAttachmentAdded: () => void;
  onRemoveLocalAttachment: (id: string) => void;
  onRemoveLocalAttachmentsBulk: (ids: string[]) => void;
  onAddLocalAttachments: (planId: string, items: Array<{ name: string; type: string; size: number }>) => void | Promise<void>;
}) {
  const { t, language } = useLanguage();
  const [showPanel, setShowPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [attMsg, setAttMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);

  const locale = language === "he" ? "he-IL" : "en-US";

  const handleDelete = async (att: DisplayAttachment) => {
    const confirmMsg = att.isLocal ? t("att_confirm_delete_local") : t("att_confirm_delete");
    const ok = window.confirm(confirmMsg);
    if (!ok) return;
    setDeleting(att.id);
    setAttMsg(null);
    try {
      if (att.isLocal) {
        onRemoveLocalAttachment(att.id);
        toast.success(t("att_deleted"));
        setSelected((prev) => { const n = new Set(prev); n.delete(att.id); return n; });
        onAttachmentAdded();
      } else {
        await removeAttachment(att.id);
        toast.success(t("att_deleted"));
        setAttMsg(null);
        setSelected((prev) => { const n = new Set(prev); n.delete(att.id); return n; });
        onAttachmentAdded();
      }
    } catch (err: unknown) {
      setAttMsg({ text: err instanceof Error ? err.message : String(err), ok: false });
    } finally {
      setDeleting(null);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (remainingSlots < 1) {
      setAttMsg({ text: t("att_limit_reached", { max: maxFamilyAttachments }), ok: false });
      return;
    }
    setUploading(true);
    setAttMsg(null);
    try {
      onAddLocalAttachments(appt.id, [{ name: file.name, type: file.type, size: file.size }]);
      toast.success(t("att_attached_success"));
      onAttachmentAdded();
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ATT_LIMIT_REACHED") {
        setAttMsg({ text: t("att_limit_reached", { max: maxFamilyAttachments }), ok: false });
      } else {
        setAttMsg({ text: err instanceof Error ? err.message : String(err), ok: false });
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = attachments.length > 0 && attachments.every((a) => selected.has(a.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(attachments.map((a) => a.id)));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const localIds = attachments.filter((a) => a.isLocal && selected.has(a.id)).map((a) => a.id);
    const driveIds = ids.filter((id) => !localIds.includes(id));
    const confirmMsg =
      localIds.length > 0 && driveIds.length === 0
        ? t("att_confirm_bulk_delete_local", { count: ids.length })
        : t("att_confirm_bulk_delete", { count: ids.length });
    const ok = window.confirm(confirmMsg);
    if (!ok) return;
    setBulkDeleting(true);
    setAttMsg(null);
    try {
      if (localIds.length > 0) onRemoveLocalAttachmentsBulk(localIds);
      if (driveIds.length > 0) {
        const result: BulkDeleteResult = await removeAttachmentsBulk(driveIds);
        const hasAuthError = result.failed.some((f) =>
          f.reason === t("auth_expired") || f.reason === t("err_auth_expired_google")
        );
        if (hasAuthError) toast.error(t("auth_expired_delete"));
        else if (result.failed.length > 0) {
          const failedNames = result.failed.map((f) => f.fileName).join(", ");
          toast.error(t("att_bulk_partial", { deleted: result.deletedCount, failed: failedNames }));
        }
      }
      setSelected(new Set());
      onAttachmentAdded();
      toast.success(t("att_bulk_deleted"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === t("auth_expired") || msg === t("err_auth_expired_google")) {
        setAttMsg({ text: t("auth_expired_delete"), ok: false });
      } else {
        setAttMsg({ text: msg, ok: false });
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleMultiFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    if (multiRef.current) multiRef.current.value = "";

    if (fileArr.length > remainingSlots) {
      setAttMsg({
        text: t("att_limit_reached", { max: maxFamilyAttachments }),
        ok: false,
      });
      return;
    }

    setUploading(true);
    setAttMsg(null);
    try {
      const items = fileArr.map((f) => ({ name: f.name, type: f.type, size: f.size }));
      await Promise.resolve(onAddLocalAttachments(appt.id, items));
      toast.success(t("att_uploaded_success"));
      onAttachmentAdded();
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ATT_LIMIT_REACHED") {
        setAttMsg({ text: t("att_limit_reached", { max: maxFamilyAttachments }), ok: false });
      } else {
        setAttMsg({ text: err instanceof Error ? err.message : String(err), ok: false });
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const displayStatus = (s: string) => {
    const key = STATUS_MAP[s];
    return key ? t(key) : s;
  };

  const statusVariant = appt.status === "בוצע" ? "success" : appt.status === "בוטל" ? "danger" : "warning";
  const initials = personName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card className="hover:shadow-[var(--shadow-card-hover)] transition-shadow">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--color-secondary)]/20 flex items-center justify-center text-[var(--color-secondary)] font-semibold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-text)]">{appt.title}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {personName} · {new Date(appt.startDateTime).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                {appt.location ? ` · ${appt.location}` : ""}
              </div>
              {appt.notes && <div className="text-xs text-[var(--color-text-muted)] mt-1">{appt.notes}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusVariant}>{displayStatus(appt.status)}</Badge>
            {appt.status !== "בוצע" && canEdit && (
              <Button size="sm" variant="secondary" onClick={onDone}>{t("today_mark_done")}</Button>
            )}
            {canEdit && (
              <Button size="sm" variant="destructive" onClick={onDelete}>{t("appt_delete")}</Button>
            )}
          </div>
        </div>

        {/* Attachments section */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {t("att_documents", { count: attachments.length })}
            </span>
            {canEdit && (
              <Button size="sm" variant="primary" onClick={() => setShowPanel(!showPanel)}>
                {showPanel ? t("close") : t("att_attach")}
              </Button>
            )}
          </div>

          {canEdit && attachments.length > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                {t("att_select_all")}
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-[var(--color-text)]">{t("att_selected", { count: selected.size })}</span>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                    {bulkDeleting ? t("att_deleting") : t("att_delete_selected")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    {t("att_clear_selection")}
                  </Button>
                </>
              )}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="grid gap-1 mb-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center gap-2 text-sm p-2 rounded-[var(--radius-sm)] ${selected.has(att.id) ? "bg-[var(--color-secondary)]/10" : "bg-[var(--color-border-light)]"}`}
                >
                  {canEdit && (
                    <input type="checkbox" checked={selected.has(att.id)} onChange={() => toggleSelect(att.id)} className="cursor-pointer" />
                  )}
                  <span className="flex-1 truncate text-[var(--color-text)]">{att.fileName}</span>
                  <div className="flex gap-2 items-center">
                    {att.driveFileId && (
                      <a href={`https://drive.google.com/file/d/${att.driveFileId}/view`} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-secondary)] hover:underline">
                        {t("open")}
                      </a>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(att)} disabled={deleting === att.id}>
                        {deleting === att.id ? t("att_deleting") : t("delete")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showPanel && canEdit && (
            <div className="flex gap-2 flex-wrap items-center">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <input ref={galleryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <input ref={multiRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => handleMultiFiles(e.target.files)} />
              <Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={uploading}>{t("att_camera")}</Button>
              <Button size="sm" variant="outline" onClick={() => galleryRef.current?.click()} disabled={uploading}>{t("att_gallery")}</Button>
              <Button size="sm" variant="secondary" onClick={() => multiRef.current?.click()} disabled={uploading}>{t("att_multi_select")}</Button>
              {uploadProgress && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("att_uploading_progress", { current: uploadProgress.current, total: uploadProgress.total })}
                  </span>
                  <div className="w-20 h-1.5 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {attMsg && !attMsg.ok && (
            <div className="mt-2 text-sm text-[var(--color-danger)]">{attMsg.text}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Main Page ── */

export default function TodayPage() {
  const { t, language } = useLanguage();
  const fb = useFamilyBound();
  const { canEdit } = useCanEdit();
  const [people, setPeople] = useState<Person[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [attIndex, setAttIndex] = useState<AttachmentsIndex | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [personId, setPersonId] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState<ReminderEntry[]>([{ value: 15, unit: "minutes" }]);
  const [showAdvancedReminders, setShowAdvancedReminders] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ name: string; type: string; size: number }>>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [localAttachmentsVersion, setLocalAttachmentsVersion] = useState(0);
  const addFormCameraRef = useRef<HTMLInputElement>(null);
  const addFormGalleryRef = useRef<HTMLInputElement>(null);
  const addFormMultiRef = useRef<HTMLInputElement>(null);

  const locale = language === "he" ? "he-IL" : "en-US";
  const hasToken = !!localStorage.getItem("famplan_google_token");

  const fetchData = async (background = false) => {
    try {
      if (!background) setStatus("loading");
      const [ppl, appts, idx] = await Promise.all([
        loadPeople(),
        loadAppointments(),
        loadIndex(),
      ]);
      setPeople(ppl);
      setAppointments(appts);
      setAttIndex(idx);
      if (ppl.length > 0 && !personId) setPersonId(ppl[0].id);
      setStatus("ready");
      setJsonCache("famplan_cache_people", { people: ppl });
      setJsonCache("famplan_cache_appointments", { appointments: appts });
      setJsonCache("famplan_cache_attachments_index", idx);
    } catch (err: unknown) {
      if (!background) {
        setStatus("error");
        setMsg({ text: err instanceof Error ? err.message : String(err), ok: false });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const refreshIndex = async () => {
    try {
      const idx = await loadIndex();
      setAttIndex(idx);
      setJsonCache("famplan_cache_attachments_index", idx);
    } catch {
      /* index will refresh on next full load */
    }
  };

  useEffect(() => {
    if (fb.status !== "bound") return;

    const cachedPpl = getJsonCache<{ people: Person[] }>("famplan_cache_people");
    const cachedAppts = getJsonCache<{ appointments: Appointment[] }>("famplan_cache_appointments");
    const cachedIdx = getJsonCache<AttachmentsIndex>("famplan_cache_attachments_index");

    const hasAnyCache = cachedPpl || cachedAppts || cachedIdx;

    if (hasAnyCache) {
      if (cachedPpl?.data) {
        const ppl = cachedPpl.data.people ?? [];
        setPeople(ppl);
        if (ppl.length > 0 && !personId) setPersonId(ppl[0].id);
      }
      if (cachedAppts?.data) setAppointments(cachedAppts.data.appointments ?? []);
      if (cachedIdx?.data) setAttIndex(cachedIdx.data);
      setStatus("ready");
      setRefreshing(true);
      fetchData(true);
    } else {
      fetchData(false);
    }
  }, [fb.status]);

  useEffect(() => {
    if (fb.toast) toast.success(fb.toast);
  }, [fb.toast]);

  const todayAppts = appointments
    .filter((a) => a.startDateTime.startsWith(todayStr()))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

  const driveCount = attIndex?.attachments?.length ?? 0;
  const localCount = getLocalAttachmentsCount();
  const totalAttachmentCount = driveCount + localCount;
  const maxFamilyAttachments = Math.max(
    attIndex?.freeLimit?.maxFamilyAttachments ?? 20,
    MAX_FAMILY_ATTACHMENTS_LOCAL
  );
  const remainingSlots = Math.max(0, maxFamilyAttachments - totalAttachmentCount);

  const addReminder = () => {
    setReminders((prev) => [...prev, { value: 15, unit: "minutes" }]);
  };

  const removeReminder = (idx: number) => {
    setReminders((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateReminder = (idx: number, patch: Partial<ReminderEntry>) => {
    setReminders((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const addPendingAttachment = (file: File) => {
    if (pendingAttachments.length + totalAttachmentCount >= maxFamilyAttachments) return;
    setPendingAttachments((prev) => [...prev, { name: file.name, type: file.type, size: file.size }]);
  };

  const addPendingAttachmentsMulti = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const canAdd = Math.min(arr.length, remainingSlots);
    if (canAdd <= 0) return;
    setPendingAttachments((prev) => [
      ...prev,
      ...arr.slice(0, canAdd).map((f) => ({ name: f.name, type: f.type, size: f.size })),
    ]);
    if (addFormMultiRef.current) addFormMultiRef.current.value = "";
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePreset = (minutes: number) => {
    if (minutes <= 0) return;
    setReminders((prev) => {
      const already = prev.some((r) => toMinutes(r) === minutes);
      if (already) {
      const next = prev.filter((r) => toMinutes(r) !== minutes);
      return next.length > 0 ? next : [{ value: 15, unit: "minutes" }];
      }
      const entry: ReminderEntry =
        minutes >= 1440 ? { value: minutes / 1440, unit: "days" } :
        minutes >= 60 ? { value: minutes / 60, unit: "hours" } :
        { value: minutes, unit: "minutes" };
      const next = [...prev, entry];
      next.sort((a, b) => toMinutes(b) - toMinutes(a));
      return next;
    });
  };

  const handleAdd = async () => {
    setMsg(null);
    if (!personId) { setMsg({ text: t("today_person_required"), ok: false }); return; }
    if (!title.trim()) { setMsg({ text: t("today_title_required"), ok: false }); return; }
    if (!start) { setMsg({ text: t("today_datetime_required"), ok: false }); return; }

    const minutesList = reminders
      .map(toMinutes)
      .filter((m) => m > 0);
    const invalid = reminders.some((r) => toMinutes(r) <= 0);
    if (invalid && reminders.length > 0) {
      setMsg({ text: t("rem_invalid"), ok: false });
      return;
    }

    const unique = [...new Set(minutesList)];
    const sorted = unique.sort((a, b) => b - a);
    const remindersPayload = sorted.length > 0
      ? sorted.map((m) => ({ minutesBeforeStart: m }))
      : [{ minutesBeforeStart: 15 }];

    setStatus("adding");
    try {
      const newAppt = await addAppointment({
        personId,
        title,
        startDateTime: new Date(start).toISOString(),
        location: location || undefined,
        notes: notes || undefined,
        reminders: remindersPayload,
      });
      if (pendingAttachments.length > 0) {
        try {
          addLocalAttachments(newAppt.id, pendingAttachments);
          setLocalAttachmentsVersion((v) => v + 1);
        } catch (e) {
          if ((e as Error & { code?: string }).code === "ATT_LIMIT_REACHED") {
            toast.error(t("att_limit_reached", { max: maxFamilyAttachments }));
          } else throw e;
        }
      }
      setTitle("");
      setLocation("");
      setNotes("");
      setStart(defaultStart());
      setReminders([{ value: 15, unit: "minutes" }]);
      setPendingAttachments([]);
      toast.success(t("added_success"));
      await fetchData();
    } catch (err: unknown) {
      setStatus("ready");
      const text = err instanceof Error ? err.message : String(err);
      setMsg({ text, ok: false });
      toast.error(text);
    }
  };

  const [deleteModalAppt, setDeleteModalAppt] = useState<Appointment | null>(null);

  const handleDone = async (id: string) => {
    try {
      await updateAppointmentStatus(id, "בוצע");
      toast.success(t("today_mark_done"));
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteConfirm = async (appt: Appointment, deleteAttachments: boolean) => {
    setDeleteModalAppt(null);
    try {
      const deleted = await deleteAppointment(appt.id);

      const calendarId = localStorage.getItem("famplan_calendar_id");
      if (calendarId && deleted.calendarEventId) {
        await deleteEvent(calendarId, deleted.calendarEventId).catch((e) => {
          if (import.meta.env.DEV) console.warn("[FamPlan] deleteEvent failed", e);
        });
      }

      await deleteAppointmentAttachments(appt.id, deleteAttachments);
      deleteLocalAttachmentsByPlan(appt.id);
      setLocalAttachmentsVersion((v) => v + 1);
      await refreshIndex();
      await fetchData();
      toast.success(t("appt_deleted"));
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      if (import.meta.env.DEV) console.error("[FamPlan] deleteAppointment failed", err);
      toast.error(t("appt_delete_failed", { reason }));
    }
  };

  const personName = (id: string) =>
    people.find((p) => p.id === id)?.fullName ?? "—";

  if (!hasToken) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("today_title")}</h1>
        <div style={{ fontSize: 14, color: "#888" }}>
          {t("login_required_settings")}
        </div>
      </div>
    );
  }

  if (fb.status === "checking") {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("today_title")}</h1>
        <div style={{ fontSize: 14, color: "#888" }}>{t("family_searching")}</div>
      </div>
    );
  }

  if (fb.status === "none") {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("today_title")}</h1>
        <div style={{ fontSize: 14, color: "#888" }}>
          {t("family_not_found")}
          <br />
          {t("family_not_found_invited")}
        </div>
      </div>
    );
  }

  if (fb.status === "multiple") {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
          {t("family_choose")}
        </h1>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
          {t("family_multiple_found")}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {fb.folders.map((f) => (
            <button
              key={f.id}
              onClick={() => fb.selectFolder(f.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fafafa",
                cursor: "pointer",
                textAlign: "start",
                fontSize: 14,
              }}
            >
              {f.name}{" "}
              <span style={{ fontSize: 11, color: "#888" }}>
                ({f.id.slice(0, 10)}…)
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (fb.status === "error") {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("today_title")}</h1>
        <div style={{ fontSize: 14, color: "red" }}>{fb.error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {t("today_heading", {
              date: new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
            })}
          </h1>
          {refreshing && <span className="text-xs text-[var(--color-text-muted)]">{t("syncing")}</span>}
        </div>
        {canEdit && (
          <Button variant="primary" size="lg" onClick={() => document.getElementById("add-form")?.scrollIntoView({ behavior: "smooth" })}>
            + {t("today_add_btn")}
          </Button>
        )}
      </div>


      {/* Add form */}
      {canEdit ? (
        <Card id="add-form">
          <div className="font-semibold text-[var(--color-text)] mb-4">{t("today_add_title")}</div>
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm bg-[var(--color-bg-card)]"
              >
                <option value="" disabled>{t("today_select_person")}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("today_title_placeholder")}
                className="flex-1 min-w-[160px] px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("today_location_placeholder")}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm"
              />
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("today_notes_placeholder")}
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm"
            />

            {/* Reminders section */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <div className="font-semibold text-sm mb-2">{t("rem_section")}</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {([1440, 180, 60, 15] as const).map((mins) => {
                  const selected = reminders.some((r) => toMinutes(r) === mins);
                  return (
                    <Button
                      key={mins}
                      size="sm"
                      variant={selected ? "primary" : "outline"}
                      onClick={() => togglePreset(mins)}
                    >
                      {mins === 1440 ? t("rem_preset_1d") : mins === 180 ? t("rem_preset_3h") : mins === 60 ? t("rem_preset_1h") : t("rem_preset_15m")}
                    </Button>
                  );
                })}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowAdvancedReminders((v) => !v)} className="mb-2">
                {t("rem_advanced")}
              </Button>
              {showAdvancedReminders && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border-light)] space-y-2">
                  {reminders.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min={1}
                        value={r.value || ""}
                        onChange={(e) => updateReminder(idx, { value: Number(e.target.value) || 0 })}
                        className="w-16 px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm"
                      />
                      <select
                        value={r.unit}
                        onChange={(e) => updateReminder(idx, { unit: e.target.value as ReminderUnit })}
                        className="px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm"
                      >
                        <option value="minutes">{t("rem_unit_minutes")}</option>
                        <option value="hours">{t("rem_unit_hours")}</option>
                        <option value="days">{t("rem_unit_days")}</option>
                      </select>
                      <span className="text-sm text-[var(--color-text-muted)]">{t("rem_before")}</span>
                      <Button size="sm" variant="destructive" onClick={() => removeReminder(idx)}>{t("rem_delete")}</Button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={addReminder}>{t("rem_add")}</Button>
                </div>
              )}
              <div className="text-xs text-[var(--color-text-muted)] mt-2">{t("rem_sound_note")}</div>
            </div>

            {/* Attachments section */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{t("att_section_title")}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("att_usage", { used: totalAttachmentCount + pendingAttachments.length, max: maxFamilyAttachments })}
                </span>
              </div>
              {pendingAttachments.length > 0 && (
                <div className="grid gap-1 mb-2">
                  {pendingAttachments.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-[var(--radius-sm)] bg-[var(--color-border-light)]">
                      <span className="flex-1 truncate text-[var(--color-text)]">{p.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => removePendingAttachment(idx)}>{t("delete")}</Button>
                    </div>
                  ))}
                </div>
              )}
              {totalAttachmentCount + pendingAttachments.length >= maxFamilyAttachments ? (
                <div className="text-sm text-[var(--color-text-muted)]">{t("att_limit_reached", { max: maxFamilyAttachments })}</div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <input ref={addFormCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addPendingAttachment(f); e.target.value = ""; }} />
                  <input ref={addFormGalleryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addPendingAttachment(f); e.target.value = ""; }} />
                  <input ref={addFormMultiRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => addPendingAttachmentsMulti(e.target.files)} />
                  <Button size="sm" variant="outline" onClick={() => addFormCameraRef.current?.click()}>{t("att_camera")}</Button>
                  <Button size="sm" variant="outline" onClick={() => addFormGalleryRef.current?.click()}>{t("att_gallery")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => addFormMultiRef.current?.click()}>{t("att_multi_select")}</Button>
                </div>
              )}
            </div>

            <Button onClick={handleAdd} disabled={status === "adding"} loading={status === "adding"}>
              {status === "adding" ? t("today_adding") : t("today_add_btn")}
            </Button>
          </div>
          {msg && !msg.ok && (
            <div className="mt-3 text-sm text-[var(--color-danger)]">{msg.text}</div>
          )}
        </Card>
      ) : (
        <div className="text-sm text-[var(--color-text-muted)] py-2">
          {t("no_edit_permission")}
        </div>
      )}

      {/* Today's appointments */}
      {status === "loading" ? (
        <div className="flex gap-3 flex-col">
          <div className="h-20 bg-[var(--color-border-light)] rounded-[var(--radius-card)] animate-pulse" />
          <div className="h-32 bg-[var(--color-border-light)] rounded-[var(--radius-card)] animate-pulse" />
          <div className="h-28 bg-[var(--color-border-light)] rounded-[var(--radius-card)] animate-pulse" />
        </div>
      ) : todayAppts.length === 0 ? (
        <EmptyState icon="calendar" title={t("today_no_appointments")} />
      ) : (
        <div className="grid gap-4">
          {todayAppts.map((a) => (
            <AppointmentCard
              key={a.id}
              appt={a}
              personName={personName(a.personId)}
              attachments={[
                ...(attIndex ? listAppointmentAttachments(attIndex, a.id).map(toDisplayAttachment) : []),
                ...listLocalAttachmentsByPlan(a.id).map(toDisplayAttachmentLocal),
              ]}
              remainingSlots={remainingSlots}
              maxFamilyAttachments={maxFamilyAttachments}
              canEdit={canEdit}
              onDone={() => handleDone(a.id)}
              onDelete={() => setDeleteModalAppt(a)}
              onAttachmentAdded={() => { refreshIndex(); fetchData(true); setLocalAttachmentsVersion((v) => v + 1); }}
              onRemoveLocalAttachment={(id) => { removeLocalAttachment(id); setLocalAttachmentsVersion((v) => v + 1); }}
              onRemoveLocalAttachmentsBulk={(ids) => { removeLocalAttachmentsBulk(ids); setLocalAttachmentsVersion((v) => v + 1); }}
              onAddLocalAttachments={(planId, items) => {
                addLocalAttachments(planId, items);
                setLocalAttachmentsVersion((v) => v + 1);
              }}
            />
          ))}
        </div>
      )}

      {deleteModalAppt && (
        <ConfirmDeleteAppointmentModal
          hasAttachments={
            (attIndex ? listAppointmentAttachments(attIndex, deleteModalAppt.id).length : 0) +
            listLocalAttachmentsByPlan(deleteModalAppt.id).length >
            0
          }
          onConfirm={(deleteAttachments) =>
            handleDeleteConfirm(deleteModalAppt, deleteAttachments)
          }
          onCancel={() => setDeleteModalAppt(null)}
        />
      )}
    </div>
  );
}

