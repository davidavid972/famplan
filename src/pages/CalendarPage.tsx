import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { PlanModal } from '../components/PlanModal';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import type { Appointment } from '../types/models';
import { generateRecurrenceStarts } from '../lib/recurrence';
import { v4 as uuidv4 } from 'uuid';

export const CalendarPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { canEdit } = useAuth();
  const { appointments, people, addAppointment, updateAppointment, deleteAppointment, deleteAppointmentsByRecurrenceGroupId, attachments, addAttachment } = useData();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [initialDate, setInitialDate] = useState<Date>(new Date());
  const [pendingDocs, setPendingDocs] = useState<Array<{ name: string; type: string; size: number }>>([]);

  const dateLocale = language === 'he' ? he : enUS;

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  /* Calendar shows ALL appointments - no filter. Index page also shows all. Filter is Plans-page only. */
  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((app) => isSameDay(new Date(app.start), day));
  };

  const totalDocs = attachments.length + pendingDocs.length;

  const handleOpenAddModal = (date: Date) => {
    if (!canEdit) return;
    setModalMode('add');
    setEditingAppointment(null);
    setInitialDate(date);
    setPendingDocs([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (app: Appointment, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setModalMode('edit');
    setEditingAppointment(app);
    setInitialDate(new Date(app.start));
    setIsModalOpen(true);
  };

  const addPendingDoc = (file: File) => {
    setPendingDocs((prev) => [...prev, { name: file.name, type: file.type || 'application/octet-stream', size: file.size }]);
  };
  const addPendingDocsMulti = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setPendingDocs((prev) => [...prev, ...arr.map((f) => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size }))]);
  };
  const removePendingDoc = (idx: number) => setPendingDocs((prev) => prev.filter((_, i) => i !== idx));

  const BATCH_SIZE = 10;

  const handleSave = async (
    data: {
      title: string;
      personId: string;
      start: number;
      end: number;
      location: string;
      notes: string;
      reminders: { minutesBeforeStart: number }[];
      recurrence?: { intervalWeeks: number; endCondition: 'date' | 'count'; endDate?: number; count?: number };
    },
    options?: { onProgress?: (c: number, t: number) => void; onRecurringProgress?: (c: number, t: number) => void; isCancelled?: () => boolean }
  ) => {
    if (modalMode === 'edit' && editingAppointment) {
      await updateAppointment(editingAppointment.id, {
        title: data.title,
        personId: data.personId,
        start: data.start,
        end: data.end,
        location: data.location,
        notes: data.notes,
        reminders: data.reminders,
      });
      showToast(t('saved_to_google_calendar'), 'success');
    } else if (data.recurrence) {
      const starts = generateRecurrenceStarts(data.start, data.recurrence);
      const total = starts.length;
      const durationMs = data.end - data.start;
      const groupId = uuidv4();
      const added: { id: string; calendarEventId?: string }[] = [];

      const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

      for (let i = 0; i < starts.length; i += BATCH_SIZE) {
        if (options?.isCancelled?.()) break;
        const batch = starts.slice(i, i + BATCH_SIZE);
        for (const startMs of batch) {
          const app = await addAppointment({
            title: data.title,
            personId: data.personId,
            start: startMs,
            end: startMs + durationMs,
            location: data.location,
            notes: data.notes,
            status: 'PLANNED',
            reminders: data.reminders,
            recurrenceGroupId: groupId,
          });
          added.push(app);
        }
        options?.onRecurringProgress?.(Math.min(i + batch.length, total), total);
        await yieldToUI();
      }

      if (pendingDocs.length > 0 && added[0]) {
        for (let i = 0; i < pendingDocs.length; i++) {
          const doc = pendingDocs[i];
          addAttachment({
            appointmentId: added[0].id,
            name: doc.name,
            type: doc.type,
            size: doc.size,
            uploaderId: 'local',
          });
          options?.onProgress?.(i + 1, pendingDocs.length);
        }
      }
      showToast(t('rec_created_count').replace('{count}', String(added.length)), 'success');
      return { calendarEventId: added[0]?.calendarEventId };
    } else {
      const newAppointment = await addAppointment({
        title: data.title,
        personId: data.personId,
        start: data.start,
        end: data.end,
        location: data.location,
        notes: data.notes,
        status: 'PLANNED',
        reminders: data.reminders,
      });
      for (let i = 0; i < pendingDocs.length; i++) {
        const doc = pendingDocs[i];
        addAttachment({
          appointmentId: newAppointment.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          uploaderId: 'local',
        });
        options?.onProgress?.(i + 1, pendingDocs.length);
      }
      if (pendingDocs.length > 0) {
        showToast(t('docs_saved'), 'success');
      } else {
        showToast(t('saved_to_google_calendar'), 'success');
      }
      return { calendarEventId: newAppointment.calendarEventId };
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAppointment(id);
    showToast(t('appointment_deleted'), 'success');
  };

  const handleDeleteSeries = async (recurrenceGroupId: string) => {
    await deleteAppointmentsByRecurrenceGroupId(recurrenceGroupId);
    showToast(t('appointment_deleted'), 'success');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAppointment(null);
    setModalMode('add');
    setPendingDocs([]);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('calendar')}</h1>
          <div className="flex items-center bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={dir === 'rtl' ? nextMonth : prevMonth}
              className="p-3 min-h-[44px] min-w-[44px] hover:bg-muted transition-colors border-r border-border flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <span className="px-4 py-2 font-medium text-foreground min-w-[120px] sm:min-w-[140px] text-center text-sm sm:text-base">
              {format(currentDate, dateFormat, { locale: dateLocale })}
            </span>
            <button
              onClick={dir === 'rtl' ? prevMonth : nextMonth}
              className="p-3 min-h-[44px] min-w-[44px] hover:bg-muted transition-colors border-l border-border flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <button
          onClick={() => handleOpenAddModal(new Date())}
          disabled={!canEdit}
          className="theme-primary-btn flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>{t('add_appointment')}</span>
        </button>
      </motion.div>

      {/* Calendar Grid */}
      <div className="theme-surface rounded-3xl overflow-hidden overflow-x-auto">
        <div className="grid grid-cols-7 border-b border-border bg-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
            const date = new Date();
            date.setDate(date.getDate() - date.getDay() + i);
            return (
              <div key={day} className="py-3 text-center text-sm font-medium text-muted-foreground">
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
                onClick={() => canEdit && handleOpenAddModal(day)}
                className={`min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 border-b border-r border-border transition-colors relative ${
                  canEdit ? 'cursor-pointer hover:bg-muted' : 'cursor-default'
                } ${!isCurrentMonth ? 'bg-muted/50 text-muted-foreground' : 'text-foreground'} ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isTodayDate ? 'bg-primary text-primary-foreground' : ''
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
                        onClick={(e) => handleOpenEditModal(app, e)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenEditModal(app)}
                        className="px-1.5 py-0.5 text-xs rounded-md truncate text-white font-medium cursor-pointer hover:opacity-90 transition-opacity"
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

      <PlanModal
        isOpen={isModalOpen}
        onClose={closeModal}
        mode={modalMode}
        appointment={editingAppointment}
        initialDate={initialDate}
        people={people}
        selectedPersonId={null}
        onSave={handleSave}
        onDelete={handleDelete}
        onDeleteSeries={handleDeleteSeries}
        pendingDocs={pendingDocs}
        onAddPendingDoc={addPendingDoc}
        onAddPendingDocsMulti={addPendingDocsMulti}
        onRemovePendingDoc={removePendingDoc}
        totalDocs={totalDocs}
        maxDocs={9999}
        remainingSlots={9999}
        canEdit={canEdit}
      />
    </div>
  );
};
