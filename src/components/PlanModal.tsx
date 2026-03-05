import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Calendar as CalendarIcon, MapPin, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { Appointment, Person, Reminder } from '../types/models';

type ReminderUnit = 'minutes' | 'hours' | 'days';
interface ReminderEntry { value: number; unit: ReminderUnit; }
function toMinutes(entry: ReminderEntry): number {
  if (entry.unit === 'minutes') return entry.value;
  if (entry.unit === 'hours') return entry.value * 60;
  return entry.value * 1440;
}

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  appointment?: Appointment | null;
  initialDate?: Date;
  people: Person[];
  selectedPersonId: string | null;
  onSave: (data: {
    title: string;
    personId: string;
    start: number;
    end: number;
    location: string;
    notes: string;
    reminders: Reminder[];
  }) => void | Promise<void | { calendarEventId?: string }>;
  onDelete?: (id: string) => void;
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
  const [reminders, setReminders] = useState<ReminderEntry[]>([{ value: 15, unit: 'minutes' }]);
  const endManuallyEditedRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCalendarEventId, setSavedCalendarEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    endManuallyEditedRef.current = false;
    if (mode === 'edit' && appointment) {
      setTitle(appointment.title);
      setPersonId(appointment.personId);
      setStart(format(appointment.start, "yyyy-MM-dd'T'HH:mm"));
      setEnd(format(appointment.end, "yyyy-MM-dd'T'HH:mm"));
      setLocation(appointment.location || '');
      setNotes(appointment.notes || '');
      const rems = appointment.reminders?.length
        ? appointment.reminders.map((r) => {
            const m = r.minutesBeforeStart;
            if (m >= 1440) return { value: m / 1440, unit: 'days' as ReminderUnit };
            if (m >= 60) return { value: m / 60, unit: 'hours' as ReminderUnit };
            return { value: m, unit: 'minutes' as ReminderUnit };
          })
        : [{ value: 15, unit: 'minutes' as ReminderUnit }];
      setReminders(rems);
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
      setReminders([{ value: 15, unit: 'minutes' }]);
    }
    setSaveError(null);
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

  const addReminder = () => setReminders((prev) => [...prev, { value: 15, unit: 'minutes' }]);
  const removeReminder = (idx: number) => setReminders((prev) => prev.filter((_, i) => i !== idx));
  const updateReminder = (idx: number, patch: Partial<ReminderEntry>) =>
    setReminders((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const togglePreset = (minutes: number) => {
    setReminders((prev) => {
      const already = prev.some((r) => toMinutes(r) === minutes);
      if (already) {
        const next = prev.filter((r) => toMinutes(r) !== minutes);
        return next.length > 0 ? next : [{ value: 15, unit: 'minutes' }];
      }
      const entry: ReminderEntry = minutes >= 1440 ? { value: minutes / 1440, unit: 'days' }
        : minutes >= 60 ? { value: minutes / 60, unit: 'hours' }
        : { value: minutes, unit: 'minutes' };
      const next = [...prev, entry];
      next.sort((a, b) => toMinutes(b) - toMinutes(a));
      return next;
    });
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
    const minutesList = reminders.map(toMinutes).filter((m) => m > 0);
    const unique = [...new Set(minutesList)].sort((a, b) => b - a);
    const remindersPayload: Reminder[] = unique.length > 0
      ? unique.map((m) => ({ minutesBeforeStart: m }))
      : [{ minutesBeforeStart: 15 }];
    const result = await onSave({
      title: title.trim(),
      personId,
      start: startMs,
      end: endMs,
      location,
      notes,
      reminders: remindersPayload,
    });
    const res = result as { calendarEventId?: string } | undefined;
    if (res?.calendarEventId) {
      setSavedCalendarEventId(res.calendarEventId);
      setTimeout(() => onClose(), 800);
    } else {
      onClose();
    }
  };

  const handleDelete = () => {
    if (mode === 'edit' && appointment && onDelete) {
      onDelete(appointment.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center shrink-0 bg-white z-10">
          <h2 className="text-xl font-bold text-stone-900">
            {mode === 'edit' ? t('edit_appointment') : t('add_appointment')}
          </h2>
        </div>

        {people.length === 0 ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
              <CalendarIcon className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-stone-600">{t('no_people')}</p>
            <button onClick={onClose} className="px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors">
              {t('cancel')}
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{saveError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('title')} *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white disabled:opacity-60"
                  placeholder={t('title')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('person')} *</label>
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => canEdit && setPersonId(person.id)}
                      disabled={!canEdit}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                        personId === person.id ? 'border-transparent text-white shadow-sm' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
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
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t('start_time')} *</label>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => handleStartChange(e.target.value)}
                    disabled={!canEdit}
                    step="300"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t('end_time')} *</label>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => handleEndChange(e.target.value)}
                    disabled={!canEdit}
                    step="300"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('location')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-stone-400" />
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={!canEdit}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white disabled:opacity-60"
                    placeholder={t('location')}
                    dir={dir}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('notes')}</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <AlignLeft className="h-5 w-5 text-stone-400" />
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!canEdit}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white min-h-[100px] resize-y disabled:opacity-60"
                    placeholder={t('notes')}
                    dir={dir}
                  />
                </div>
              </div>

              {/* Reminders */}
              <div className="pt-4 border-t border-stone-200">
                <label className="block text-sm font-medium text-stone-700 mb-2">{t('rem_section')}</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {([1440, 180, 60, 15] as const).map((mins) => {
                    const selected = reminders.some((r) => toMinutes(r) === mins);
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => canEdit && togglePreset(mins)}
                        disabled={!canEdit}
                        className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${selected ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                      >
                        {mins === 1440 ? t('rem_preset_1d') : mins === 180 ? t('rem_preset_3h') : mins === 60 ? t('rem_preset_1h') : t('rem_preset_15m')}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-stone-500 mb-1">{t('rem_custom')}</p>
                <div className="space-y-2">
                  {reminders.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min={1}
                        value={r.value || ''}
                        onChange={(e) => updateReminder(idx, { value: Number(e.target.value) || 0 })}
                        disabled={!canEdit}
                        className="w-16 px-2 py-1.5 rounded-lg border border-stone-200 text-sm disabled:opacity-60"
                      />
                      <select
                        value={r.unit}
                        onChange={(e) => updateReminder(idx, { unit: e.target.value as ReminderUnit })}
                        disabled={!canEdit}
                        className="px-2 py-1.5 rounded-lg border border-stone-200 text-sm disabled:opacity-60"
                      >
                        <option value="minutes">{t('rem_unit_minutes')}</option>
                        <option value="hours">{t('rem_unit_hours')}</option>
                        <option value="days">{t('rem_unit_days')}</option>
                      </select>
                      <span className="text-sm text-stone-500">{t('rem_before')}</span>
                      <button type="button" onClick={() => canEdit && removeReminder(idx)} disabled={!canEdit} className="px-3 py-2 min-h-[44px] text-red-600 hover:bg-red-50 rounded-lg text-sm disabled:opacity-60">
                        {t('rem_delete')}
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => canEdit && addReminder()} disabled={!canEdit} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-60">
                    {t('rem_add')}
                  </button>
                </div>
              </div>

              {/* Documents - only in add mode */}
              {mode === 'add' && onAddPendingDoc && (
                <div className="pt-4 border-t border-stone-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-stone-700">{t('docs_section_attached')}</label>
                    <span className="text-xs text-stone-500">{t('docs_counter').replace('{used}', String(totalDocs))}</span>
                  </div>
                  {pendingDocs.length > 0 && onRemovePendingDoc && (
                    <div className="space-y-1 mb-2">
                      {pendingDocs.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2 bg-stone-50 rounded-lg">
                          <span className="truncate text-stone-700">{p.name}</span>
                          <button type="button" onClick={() => onRemovePendingDoc(idx)} disabled={!canEdit} className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-60">
                            {t('delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {totalDocs >= maxDocs ? (
                    <p className="text-sm text-amber-600">{t('docs_limit_reached')}</p>
                  ) : canEdit && (
                    <div className="flex gap-2 flex-wrap">
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPendingDoc(f); e.target.value = ''; }} />
                        {t('docs_camera')}
                      </label>
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPendingDoc(f); e.target.value = ''; }} />
                        {t('docs_gallery')}
                      </label>
                      <label className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => onAddPendingDocsMulti?.(e.target.files)} />
                        {t('docs_multi')}
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {savedCalendarEventId && (
              <div className="px-6 py-2 text-xs text-stone-500 font-mono bg-stone-100 rounded-lg mx-6 mb-2">
                calendarEventId: {savedCalendarEventId}
              </div>
            )}
            <div className="flex justify-between gap-3 p-6 bg-stone-50 border-t border-stone-100 shrink-0 z-10">
              <div>
                {mode === 'edit' && appointment && onDelete && canEdit && (
                  <button
                    onClick={handleDelete}
                    className="px-6 py-3 font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    {t('delete')}
                  </button>
                )}
              </div>
              <div className="flex gap-3 ms-auto">
                <button onClick={onClose} className="px-6 py-3 font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canEdit}
                  className="px-6 py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
