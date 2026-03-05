import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, AlignLeft } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { Reminder } from '../types/models';

type ReminderUnit = 'minutes' | 'hours' | 'days';
interface ReminderEntry { value: number; unit: ReminderUnit; }
function toMinutes(entry: ReminderEntry): number {
  if (entry.unit === 'minutes') return entry.value;
  if (entry.unit === 'hours') return entry.value * 60;
  return entry.value * 1440;
}

export const CalendarPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { appointments, people, addAppointment, attachments, addAttachment } = useData();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const dateLocale = language === 'he' ? he : enUS;

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredAppointments = appointments.filter(
    (app) => !selectedPersonId || app.personId === selectedPersonId
  );

  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter((app) => isSameDay(new Date(app.start), day));
  };

  const [newAppt, setNewAppt] = useState({
    title: '',
    personId: '',
    start: '',
    end: '',
    location: '',
    notes: '',
  });
  const [reminders, setReminders] = useState<ReminderEntry[]>([{ value: 15, unit: 'minutes' }]);
  const [pendingDocs, setPendingDocs] = useState<Array<{ name: string; type: string; size: number }>>([]);

  const MAX_DOCS = 20;
  const totalDocs = attachments.length + pendingDocs.length;
  const remainingSlots = Math.max(0, MAX_DOCS - attachments.length);

  const handleOpenModal = (date: Date) => {
    setSelectedDate(date);
    setNewAppt({
      title: '',
      personId: selectedPersonId || (people.length > 0 ? people[0].id : ''),
      start: format(date, "yyyy-MM-dd'T'09:00"),
      end: format(date, "yyyy-MM-dd'T'10:00"),
      location: '',
      notes: '',
    });
    setReminders([{ value: 15, unit: 'minutes' }]);
    setPendingDocs([]);
    setIsModalOpen(true);
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

  const addPendingDoc = (file: File) => {
    if (totalDocs >= MAX_DOCS) return;
    setPendingDocs((prev) => [...prev, { name: file.name, type: file.type || 'application/octet-stream', size: file.size }]);
  };
  const addPendingDocsMulti = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const canAdd = Math.min(files.length, remainingSlots - pendingDocs.length);
    if (canAdd <= 0) return;
    const arr = Array.from(files).slice(0, canAdd);
    setPendingDocs((prev) => [...prev, ...arr.map((f) => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size }))]);
  };
  const removePendingDoc = (idx: number) => setPendingDocs((prev) => prev.filter((_, i) => i !== idx));

  const handleSaveAppointment = () => {
    if (!newAppt.title || !newAppt.personId || !newAppt.start || !newAppt.end) {
      showToast(t('required_field'), 'error');
      return;
    }

    const startMs = new Date(newAppt.start).getTime();
    const endMs = new Date(newAppt.end).getTime();

    if (endMs <= startMs) {
      showToast(t('end_time_error'), 'error');
      return;
    }

    const minutesList = reminders.map(toMinutes).filter((m) => m > 0);
    const unique = [...new Set(minutesList)].sort((a, b) => b - a);
    const remindersPayload: Reminder[] = unique.length > 0
      ? unique.map((m) => ({ minutesBeforeStart: m }))
      : [{ minutesBeforeStart: 15 }];

    const newAppointment = addAppointment({
      title: newAppt.title,
      personId: newAppt.personId,
      start: startMs,
      end: endMs,
      location: newAppt.location,
      notes: newAppt.notes,
      status: 'PLANNED',
      reminders: remindersPayload,
    });

    pendingDocs.forEach((doc) => {
      addAttachment({
        appointmentId: newAppointment.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        uploaderId: 'local',
      });
    });

    showToast(t('appointment_added'), 'success');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{t('calendar')}</h1>
          <div className="flex items-center bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <button
              onClick={dir === 'rtl' ? nextMonth : prevMonth}
              className="p-2 hover:bg-stone-50 transition-colors border-r border-stone-200"
            >
              <ChevronLeft className="w-5 h-5 text-stone-600" />
            </button>
            <span className="px-4 py-2 font-medium text-stone-900 min-w-[140px] text-center">
              {format(currentDate, dateFormat, { locale: dateLocale })}
            </span>
            <button
              onClick={dir === 'rtl' ? prevMonth : nextMonth}
              className="p-2 hover:bg-stone-50 transition-colors border-l border-stone-200"
            >
              <ChevronRight className="w-5 h-5 text-stone-600" />
            </button>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal(new Date())}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>{t('add_appointment')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedPersonId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedPersonId === null
              ? 'bg-stone-900 text-white'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          {t('all')}
        </button>
        {people.map((person) => (
          <button
            key={person.id}
            onClick={() => setSelectedPersonId(person.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              selectedPersonId === person.id
                ? 'text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
            style={{
              backgroundColor: selectedPersonId === person.id ? person.color : 'white',
              borderColor: selectedPersonId === person.id ? person.color : undefined,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedPersonId === person.id ? 'white' : person.color }}
            />
            {person.name}
          </button>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
            const date = new Date();
            date.setDate(date.getDate() - date.getDay() + i);
            return (
              <div key={day} className="py-3 text-center text-sm font-medium text-stone-500">
                {format(date, 'EEEEEE', { locale: dateLocale })}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day, dayIdx) => {
            const dayAppointments = getAppointmentsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toString()}
                onClick={() => handleOpenModal(day)}
                className={`min-h-[100px] p-2 border-b border-r border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors relative ${
                  !isCurrentMonth ? 'bg-stone-50/50 text-stone-400' : 'text-stone-900'
                } ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isTodayDate ? 'bg-emerald-600 text-white' : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                  {dayAppointments.map((app) => {
                    const person = people.find((p) => p.id === app.personId);
                    if (!person) return null;
                    return (
                      <div
                        key={app.id}
                        className="px-1.5 py-0.5 text-xs rounded-md truncate text-white font-medium"
                        style={{ backgroundColor: person.color }}
                        title={app.title}
                      >
                        {format(app.start, 'HH:mm')} {app.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-stone-900">{t('add_appointment')}</h2>
            </div>
            
            {people.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-stone-600">{t('no_people')}</p>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('title')} *
                    </label>
                    <input
                      type="text"
                      value={newAppt.title}
                      onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      placeholder={t('title')}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('person')} *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {people.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => setNewAppt({ ...newAppt, personId: person.id })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                            newAppt.personId === person.id
                              ? 'border-transparent text-white shadow-sm'
                              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                          }`}
                          style={{
                            backgroundColor: newAppt.personId === person.id ? person.color : undefined,
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: newAppt.personId === person.id ? 'white' : person.color }}
                          />
                          {person.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        {t('start_time')} *
                      </label>
                      <input
                        type="datetime-local"
                        value={newAppt.start}
                        onChange={(e) => setNewAppt({ ...newAppt, start: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        {t('end_time')} *
                      </label>
                      <input
                        type="datetime-local"
                        value={newAppt.end}
                        onChange={(e) => setNewAppt({ ...newAppt, end: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('location')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-stone-400" />
                      </div>
                      <input
                        type="text"
                        value={newAppt.location}
                        onChange={(e) => setNewAppt({ ...newAppt, location: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                        placeholder={t('location')}
                        dir={dir}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('notes')}
                    </label>
                    <div className="relative">
                      <div className="absolute top-3 left-3 pointer-events-none">
                        <AlignLeft className="h-5 w-5 text-stone-400" />
                      </div>
                      <textarea
                        value={newAppt.notes}
                        onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white min-h-[100px] resize-y"
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
                          <button key={mins} type="button" onClick={() => togglePreset(mins)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selected ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                            {mins === 1440 ? t('rem_preset_1d') : mins === 180 ? t('rem_preset_3h') : mins === 60 ? t('rem_preset_1h') : t('rem_preset_15m')}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-stone-500 mb-1">{t('rem_custom')}</p>
                    <div className="space-y-2">
                      {reminders.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <input type="number" min={1} value={r.value || ''} onChange={(e) => updateReminder(idx, { value: Number(e.target.value) || 0 })}
                            className="w-16 px-2 py-1.5 rounded-lg border border-stone-200 text-sm" />
                          <select value={r.unit} onChange={(e) => updateReminder(idx, { unit: e.target.value as ReminderUnit })}
                            className="px-2 py-1.5 rounded-lg border border-stone-200 text-sm">
                            <option value="minutes">{t('rem_unit_minutes')}</option>
                            <option value="hours">{t('rem_unit_hours')}</option>
                            <option value="days">{t('rem_unit_days')}</option>
                          </select>
                          <span className="text-sm text-stone-500">{t('rem_before')}</span>
                          <button type="button" onClick={() => removeReminder(idx)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm">{t('rem_delete')}</button>
                        </div>
                      ))}
                      <button type="button" onClick={addReminder} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">{t('rem_add')}</button>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="pt-4 border-t border-stone-200">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-stone-700">{t('docs_section_attached')}</label>
                      <span className="text-xs text-stone-500">{t('docs_counter').replace('{used}', String(totalDocs))}</span>
                    </div>
                    {pendingDocs.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {pendingDocs.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2 bg-stone-50 rounded-lg">
                            <span className="truncate text-stone-700">{p.name}</span>
                            <button type="button" onClick={() => removePendingDoc(idx)} className="text-red-600 hover:text-red-700 text-xs font-medium">{t('delete')}</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {totalDocs >= MAX_DOCS ? (
                      <p className="text-sm text-amber-600">{t('docs_limit_reached')}</p>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addPendingDoc(f); e.target.value = ''; }} />
                          {t('docs_camera')}
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addPendingDoc(f); e.target.value = ''; }} />
                          {t('docs_gallery')}
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer text-sm font-medium text-stone-700">
                          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => addPendingDocsMulti(e.target.files)} />
                          {t('docs_multi')}
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-6 bg-stone-50 border-t border-stone-100 sticky bottom-0 z-10">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveAppointment}
                    className="px-6 py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    {t('save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
