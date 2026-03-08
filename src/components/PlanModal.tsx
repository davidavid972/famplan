import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Calendar as CalendarIcon, MapPin, AlignLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Appointment, Person, Reminder } from '../types/models';
import { generateRecurrenceStarts } from '../lib/recurrence';

const REMINDER_OPTIONS = [5, 10, 15, 30, 60, 180, 1440] as const;
const REC_INTERVAL_OPTIONS = [1, 2, 3, 4] as const;

export interface RecurrenceParams {
  intervalWeeks: number;
  endCondition: 'date' | 'count';
  endDate?: number;
  count?: number;
}

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  appointment?: Appointment | null;
  initialDate?: Date;
  people: Person[];
  selectedPersonId: string | null;
  onSave: (
    data: {
      title: string;
      personId: string;
      start: number;
      end: number;
      location: string;
      notes: string;
      reminders: Reminder[];
      recurrence?: RecurrenceParams;
    },
    options?: {
      onProgress?: (current: number, total: number) => void;
      onRecurringProgress?: (current: number, total: number) => void;
      isCancelled?: () => boolean;
    }
  ) => void | Promise<void | { calendarEventId?: string }>;
  onDelete?: (id: string) => void;
  onDeleteSeries?: (recurrenceGroupId: string) => void;
  pendingDocs?: Array<{ name: string; type: string; size: number }>;
  onAddPendingDoc?: (file: File) => void;
  onAddPendingDocsMulti?: (files: FileList | null) => void;
  onRemovePendingDoc?: (idx: number) => void;
  totalDocs?: number;
  maxDocs?: number;
  remainingSlots?: number;
  canEdit: boolean;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  mode,
  appointment,
  initialDate,
  people,
  selectedPersonId,
  onSave,
  onDelete,
  onDeleteSeries,
  pendingDocs = [],
  onAddPendingDoc,
  onAddPendingDocsMulti,
  onRemovePendingDoc,
  totalDocs = 0,
  maxDocs = 20,
  remainingSlots = 20,
  canEdit,
}) => {
  const { t, dir, language } = useI18n();
  const [title, setTitle] = useState('');
  const [personId, setPersonId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(15);
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [endCondition, setEndCondition] = useState<'date' | 'count'>('date');
  const [endDateStr, setEndDateStr] = useState('');
  const [endCount, setEndCount] = useState(4);
  const endManuallyEditedRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCalendarEventId, setSavedCalendarEventId] = useState<string | null>(null);
  const [showDeleteChoice, setShowDeleteChoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [recurringProgress, setRecurringProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setShowDeleteChoice(false);
    endManuallyEditedRef.current = false;
    if (mode === 'edit' && appointment) {
      setTitle(appointment.title);
      setPersonId(appointment.personId);
      setStart(format(appointment.start, "yyyy-MM-dd'T'HH:mm"));
      setEnd(format(appointment.end, "yyyy-MM-dd'T'HH:mm"));
      setLocation(appointment.location || '');
      setNotes(appointment.notes || '');
      const first = appointment.reminders?.[0]?.minutesBeforeStart;
      setReminderMinutes(first != null && first > 0 ? first : null);
      setIsRecurring(false);
    } else {
      const date = initialDate || new Date();
      const startStr = format(date, "yyyy-MM-dd'T'09:00");
      const startDate = new Date(startStr);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const endStr = format(endDate, "yyyy-MM-dd'T'HH:mm");
      setTitle('');
      setPersonId(selectedPersonId || (people.length > 0 ? people[0].id : ''));
      setStart(startStr);
      setEnd(endStr);
      setLocation('');
      setNotes('');
      setReminderMinutes(15);
      setIsRecurring(false);
      setIntervalWeeks(1);
      setEndCondition('date');
      const defaultEnd = new Date(date);
      defaultEnd.setMonth(defaultEnd.getMonth() + 3);
      setEndDateStr(format(defaultEnd, 'yyyy-MM-dd'));
      setEndCount(4);
    }
    setSaveError(null);
    setIsSaving(false);
    setIsProcessingFiles(false);
    setUploadProgress(null);
    setRecurringProgress(null);
    cancelledRef.current = false;
  }, [isOpen, mode, appointment, initialDate, people, selectedPersonId]);

  const handleStartChange = (val: string) => {
    setStart(val);
    if (!endManuallyEditedRef.current && val) {
      const d = new Date(val);
      d.setMinutes(d.getMinutes() + 60);
      setEnd(format(d, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleEndChange = (val: string) => {
    endManuallyEditedRef.current = true;
    setEnd(val);
  };

  const handleSubmit = async () => {
    setSaveError(null);
    setSavedCalendarEventId(null);
    if (!title.trim() || !personId || !start || !end) {
      setSaveError(t('required_field'));
      return;
    }
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (endMs <= startMs) {
      setSaveError(t('end_time_error'));
      return;
    }
    const remindersPayload: Reminder[] =
      reminderMinutes != null ? [{ minutesBeforeStart: reminderMinutes }] : [];
    let recurrence: RecurrenceParams | undefined;
    if (mode === 'add' && isRecurring) {
      if (endCondition === 'date' && !endDateStr) {
        setSaveError(t('required_field'));
        return;
      }
      const endDateMs = endCondition === 'date' && endDateStr
        ? new Date(endDateStr + 'T23:59:59').getTime()
        : undefined;
      recurrence = {
        intervalWeeks,
        endCondition,
        endDate: endDateMs,
        count: endCondition === 'count' ? endCount : undefined,
      };
    }
    setIsSaving(true);
    cancelledRef.current = false;
    setUploadProgress(pendingDocs.length > 0 ? { current: 0, total: pendingDocs.length } : null);
    const recTotal = recurrence ? generateRecurrenceStarts(startMs, recurrence).length : 0;
    setRecurringProgress(recurrence && recTotal > 0 ? { current: 0, total: recTotal } : null);
    try {
      const saveOptions: { onProgress?: (c: number, t: number) => void; onRecurringProgress?: (c: number, t: number) => void; isCancelled?: () => boolean } = {};
      if (pendingDocs.length > 0) saveOptions.onProgress = (c, t) => setUploadProgress({ current: c, total: t });
      if (recurrence) {
        saveOptions.onRecurringProgress = (c, t) => setRecurringProgress({ current: c, total: t });
        saveOptions.isCancelled = () => cancelledRef.current;
      }
      const result = await onSave(
        {
          title: title.trim(),
          personId,
          start: startMs,
          end: endMs,
          location,
          notes,
          reminders: remindersPayload,
          recurrence,
        },
        Object.keys(saveOptions).length > 0 ? saveOptions : undefined
      );
      const res = result as { calendarEventId?: string } | undefined;
      if (res?.calendarEventId) {
        setSavedCalendarEventId(res.calendarEventId);
        setTimeout(() => onClose(), 800);
      } else {
        onClose();
      }
    } catch {
      setSaveError(t('docs_upload_failed'));
      setIsSaving(false);
      setUploadProgress(null);
      setRecurringProgress(null);
    }
  };

  const handleRecurringCancel = () => {
    cancelledRef.current = true;
  };

  const handleDelete = () => {
    if (mode !== 'edit' || !appointment || !onDelete) return;
    if (appointment.recurrenceGroupId && onDeleteSeries && !showDeleteChoice) {
      setShowDeleteChoice(true);
      return;
    }
    onDelete(appointment.id);
    onClose();
  };

  const handleDeleteSeries = () => {
    if (mode === 'edit' && appointment?.recurrenceGroupId && onDeleteSeries) {
      onDeleteSeries(appointment.recurrenceGroupId);
      onClose();
    }
  };

  const handleDeleteThisOnly = () => {
    if (mode === 'edit' && appointment && onDelete) {
      onDelete(appointment.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
      {recurringProgress && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl">
          <div className="theme-surface rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-foreground font-medium">
              {t('rec_progress').replace('{current}', String(recurringProgress.current)).replace('{total}', String(recurringProgress.total))}
            </p>
            <button
              type="button"
              onClick={handleRecurringCancel}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-xl hover:bg-muted transition-colors"
            >
              {t('rec_cancel')}
            </button>
          </div>
        </div>
      )}
      <div className="theme-surface rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-border flex justify-between items-center shrink-0 bg-card z-10">
          <h2 className="text-xl font-bold text-foreground">
            {mode === 'edit' ? t('edit_appointment') : t('add_appointment')}
          </h2>
        </div>

        {people.length === 0 ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
              <CalendarIcon className="w-8 h-8 text-accent" />
            </div>
            <p className="text-muted-foreground">{t('no_people')}</p>
            <button onClick={onClose} className="px-6 py-2 bg-foreground text-background rounded-xl hover:opacity-90 transition-colors">
              {t('cancel')}
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              {saveError && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">{saveError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('title')} *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card disabled:opacity-60"
                  placeholder={t('title')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('person')} *</label>
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => canEdit && setPersonId(person.id)}
                      disabled={!canEdit}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                        personId === person.id ? 'border-transparent text-white shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      style={{ backgroundColor: personId === person.id ? person.color : undefined }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: personId === person.id ? 'white' : person.color }} />
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4" lang={language === 'he' ? 'he-IL' : 'en-GB'}>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('start_time')} *</label>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => handleStartChange(e.target.value)}
                    disabled={!canEdit}
                    step="300"
                    className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('end_time')} *</label>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => handleEndChange(e.target.value)}
                    disabled={!canEdit}
                    step="300"
                    className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('location')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={!canEdit}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card disabled:opacity-60"
                    placeholder={t('location')}
                    dir={dir}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('notes')}</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <AlignLeft className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!canEdit}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card min-h-[100px] resize-y disabled:opacity-60"
                    placeholder={t('notes')}
                    dir={dir}
                  />
                </div>
              </div>

              {/* Reminders */}
              <div className="pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-2">{t('rem_alert')}</label>
                <select
                  value={reminderMinutes ?? 'none'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setReminderMinutes(v === 'none' ? null : Number(v));
                  }}
                  disabled={!canEdit}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card disabled:opacity-60"
                >
                  <option value="none">{t('rem_no_reminder')}</option>
                  {REMINDER_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 5 ? t('rem_5m') : mins === 10 ? t('rem_10m') : mins === 15 ? t('rem_preset_15m') : mins === 30 ? t('rem_30m') : mins === 60 ? t('rem_preset_1h') : mins === 180 ? t('rem_preset_3h') : t('rem_preset_1d')}
                    </option>
                  ))}
                  {reminderMinutes != null && !REMINDER_OPTIONS.includes(reminderMinutes) && (
                    <option value={reminderMinutes}>
                      {reminderMinutes < 60 ? `${reminderMinutes} ${t('rem_unit_minutes')}` : reminderMinutes < 1440 ? `${Math.round(reminderMinutes / 60)} ${t('rem_unit_hours')}` : `${Math.round(reminderMinutes / 1440)} ${t('rem_unit_days')}`} {t('rem_before')}
                    </option>
                  )}
                </select>
              </div>

              {/* Recurrence - add mode only */}
              {mode === 'add' && (
                <div className="pt-4 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-2">{t('rec_section')}</label>
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isRecurring}
                      onClick={() => canEdit && setIsRecurring((v) => !v)}
                      disabled={!canEdit}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors disabled:opacity-60 ${
                        isRecurring ? 'bg-primary border-primary' : 'bg-muted border-border'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm font-medium text-foreground">{t('rec_repeating')}</span>
                  </div>
                  {isRecurring && (
                    <div className="space-y-3 pl-0">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('rec_weekly')}</label>
                        <select
                          value={intervalWeeks}
                          onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted disabled:opacity-60"
                        >
                          <option value={1}>{t('rec_weekly')}</option>
                          <option value={2}>{t('rec_every_2_weeks')}</option>
                          {REC_INTERVAL_OPTIONS.filter((x) => x > 2).map((w) => (
                            <option key={w} value={w}>{t('rec_every_x_weeks').replace('X', String(w))}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="endCondition"
                            checked={endCondition === 'date'}
                            onChange={() => setEndCondition('date')}
                            disabled={!canEdit}
                            className="rounded-full"
                          />
                          <span className="text-sm">{t('rec_until_date')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="endCondition"
                            checked={endCondition === 'count'}
                            onChange={() => setEndCondition('count')}
                            disabled={!canEdit}
                            className="rounded-full"
                          />
                          <span className="text-sm">{t('rec_times_count')}</span>
                        </label>
                      </div>
                      {endCondition === 'date' && (
                        <input
                          type="date"
                          value={endDateStr}
                          onChange={(e) => setEndDateStr(e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted disabled:opacity-60"
                          lang={language === 'he' ? 'he-IL' : 'en-GB'}
                        />
                      )}
                      {endCondition === 'count' && (
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={endCount}
                          onChange={(e) => setEndCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted disabled:opacity-60"
                        />
                      )}
                      {isRecurring && start && (
                        <p className="text-xs text-muted-foreground">
                          {t('rec_summary').replace(
                            '{count}',
                            String(
                              generateRecurrenceStarts(new Date(start).getTime(), {
                                intervalWeeks,
                                endCondition,
                                endDate: endCondition === 'date' && endDateStr ? new Date(endDateStr + 'T23:59:59').getTime() : undefined,
                                count: endCondition === 'count' ? endCount : undefined,
                              }).length
                            )
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Documents - only in add mode */}
              {mode === 'add' && onAddPendingDoc && (
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-foreground">{t('docs_section_attached')}</label>
                    <span className="text-xs text-muted-foreground">{t('docs_counter').replace('{used}', String(totalDocs))}</span>
                  </div>
                  {pendingDocs.length > 0 && onRemovePendingDoc && (
                    <div className="space-y-1 mb-2">
                      {pendingDocs.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2 bg-muted rounded-lg">
                          <span className="truncate text-foreground">{p.name}</span>
                          <button type="button" onClick={() => onRemovePendingDoc(idx)} disabled={!canEdit} className="text-destructive hover:text-destructive/90 text-xs font-medium disabled:opacity-60">
                            {t('delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(isProcessingFiles || uploadProgress) && (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      {uploadProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>{t('docs_uploading').replace('{current}', String(uploadProgress.current)).replace('{total}', String(uploadProgress.total))}</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>{t('docs_processing')}</span>
                        </>
                      )}
                    </div>
                  )}
                  {canEdit && !isSaving && (
                    <div className="flex gap-2 flex-wrap">
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-card border border-border rounded-xl hover:bg-muted cursor-pointer text-sm font-medium text-foreground">
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIsProcessingFiles(true); setTimeout(0, () => { onAddPendingDoc(f); setIsProcessingFiles(false); }); } e.target.value = ''; }} />
                        {t('docs_camera')}
                      </label>
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-card border border-border rounded-xl hover:bg-muted cursor-pointer text-sm font-medium text-foreground">
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIsProcessingFiles(true); setTimeout(0, () => { onAddPendingDoc(f); setIsProcessingFiles(false); }); } e.target.value = ''; }} />
                        {t('docs_gallery')}
                      </label>
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-card border border-border rounded-xl hover:bg-muted cursor-pointer text-sm font-medium text-foreground">
                        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { const files = e.target.files; if (files?.length) { setIsProcessingFiles(true); setTimeout(0, () => { onAddPendingDocsMulti?.(files); setIsProcessingFiles(false); }); } e.target.value = ''; }} />
                        {t('docs_multi')}
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {savedCalendarEventId && (
              <div className="px-6 py-2 text-xs text-muted-foreground font-mono bg-secondary rounded-lg mx-6 mb-2">
                calendarEventId: {savedCalendarEventId}
              </div>
            )}
            <div className="flex justify-between gap-3 p-6 bg-muted border-t border-border shrink-0 z-10">
              <div className="flex items-center gap-2">
                {mode === 'edit' && appointment && onDelete && canEdit && !showDeleteChoice && (
                  <button
                    onClick={handleDelete}
                    className="px-6 py-3 font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-xl hover:bg-destructive/20 transition-colors"
                  >
                    {t('delete')}
                  </button>
                )}
                {mode === 'edit' && appointment && onDelete && canEdit && showDeleteChoice && (
                  <>
                    <button
                      onClick={handleDeleteThisOnly}
                      className="px-4 py-2 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-xl hover:bg-destructive/20 transition-colors"
                    >
                      {t('rec_delete_this_only')}
                    </button>
                    <button
                      onClick={handleDeleteSeries}
                      className="px-4 py-2 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-xl hover:bg-destructive/20 transition-colors"
                    >
                      {t('rec_delete_whole_series')}
                    </button>
                    <button
                      onClick={() => setShowDeleteChoice(false)}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-3 ms-auto">
                <button onClick={onClose} className="px-6 py-3 font-medium text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors">
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canEdit || isSaving}
                  className="px-6 py-3 font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('save')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
