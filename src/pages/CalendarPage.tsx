import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { PlanModal } from '../components/PlanModal';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import type { Appointment } from '../types/models';

export const CalendarPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { canEdit } = useAuth();
  const { appointments, people, addAppointment, updateAppointment, deleteAppointment, attachments, addAttachment } = useData();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
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

  const filteredAppointments = appointments.filter(
    (app) => !selectedPersonId || app.personId === selectedPersonId
  );

  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter((app) => isSameDay(new Date(app.start), day));
  };

  const MAX_DOCS = 20;
  const totalDocs = attachments.length + pendingDocs.length;
  const remainingSlots = Math.max(0, MAX_DOCS - attachments.length);

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

  const handleSave = (data: { title: string; personId: string; start: number; end: number; location: string; notes: string; reminders: { minutesBeforeStart: number }[] }) => {
    if (modalMode === 'edit' && editingAppointment) {
      updateAppointment(editingAppointment.id, {
        title: data.title,
        personId: data.personId,
        start: data.start,
        end: data.end,
        location: data.location,
        notes: data.notes,
        reminders: data.reminders,
      });
      showToast(t('appointment_updated'), 'success');
    } else {
      const newAppointment = addAppointment({
        title: data.title,
        personId: data.personId,
        start: data.start,
        end: data.end,
        location: data.location,
        notes: data.notes,
        status: 'PLANNED',
        reminders: data.reminders,
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
    }
  };

  const handleDelete = (id: string) => {
    deleteAppointment(id);
    showToast(t('appointment_deleted'), 'success');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAppointment(null);
    setModalMode('add');
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
          onClick={() => handleOpenAddModal(new Date())}
          disabled={!canEdit}
          className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
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
                onClick={() => canEdit && handleOpenAddModal(day)}
                className={`min-h-[100px] p-2 border-b border-r border-stone-100 transition-colors relative ${
                  canEdit ? 'cursor-pointer hover:bg-stone-50' : 'cursor-default'
                } ${!isCurrentMonth ? 'bg-stone-50/50 text-stone-400' : 'text-stone-900'} ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`}
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
        selectedPersonId={selectedPersonId}
        onSave={handleSave}
        onDelete={handleDelete}
        pendingDocs={pendingDocs}
        onAddPendingDoc={addPendingDoc}
        onAddPendingDocsMulti={addPendingDocsMulti}
        onRemovePendingDoc={removePendingDoc}
        totalDocs={totalDocs}
        maxDocs={MAX_DOCS}
        remainingSlots={remainingSlots}
        canEdit={canEdit}
      />
    </div>
  );
};
