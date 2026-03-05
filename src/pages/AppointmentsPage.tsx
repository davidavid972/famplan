import React, { useState, useRef, useCallback } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useFamily } from '../context/FamilyProvider';
import { useToast } from '../context/ToastProvider';
import { PlanModal } from '../components/PlanModal';
import { PlansFilterBar } from '../components/PlansFilterBar';
import { PersonAvatar } from '../components/PersonAvatar';
import { Calendar as CalendarIcon, MapPin, AlignLeft, CheckCircle2, Circle, Trash2, X, Square, CheckSquare } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Appointment, AppointmentStatus } from '../types/models';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

export const AppointmentsPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { canEdit } = useAuth();
  const { planFilterPersonIds, selectionColor } = useFamily();
  const { appointments, people, updateAppointment, deleteAppointment, deleteAppointments } = useData();
  const { showToast } = useToast();

  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const dateLocale = language === 'he' ? he : enUS;

  const getPerson = (id: string) => people.find((p) => p.id === id);

  const toggleStatus = (appointment: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: AppointmentStatus = appointment.status === 'PLANNED' ? 'DONE' : 'PLANNED';
    updateAppointment(appointment.id, { status: newStatus });
    showToast(t('appointment_updated'), 'success');
  };

  const handleDelete = async () => {
    if (appointmentToDelete) {
      await deleteAppointment(appointmentToDelete);
      showToast(t('appointment_deleted'), 'success');
      setAppointmentToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size > 0) {
      await deleteAppointments(Array.from(selectedIds));
      showToast(t('appointment_deleted'), 'success');
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setBulkDeleteConfirm(false);
    }
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCardTouchStart = useCallback((appointment: Appointment) => {
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      didLongPressRef.current = true;
      setIsSelectMode(true);
      setSelectedIds((prev) => new Set(prev).add(appointment.id));
    }, 500);
  }, []);

  const handleCardTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCardClick = useCallback((appointment: Appointment) => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (isSelectMode) {
      toggleSelection(appointment.id);
    } else {
      setEditingAppointment(appointment);
    }
  }, [isSelectMode, toggleSelection]);

  const handleSaveFromModal = async (data: { title: string; personId: string; start: number; end: number; location: string; notes: string; reminders: { minutesBeforeStart: number }[] }) => {
    if (editingAppointment) {
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
    }
  };

  const handleDeleteFromModal = async (id: string) => {
    await deleteAppointment(id);
    showToast(t('appointment_deleted'), 'success');
    setEditingAppointment(null);
  };

  // Filter by people (multi-select)
  const filterSet = planFilterPersonIds && planFilterPersonIds.length > 0 ? new Set(planFilterPersonIds) : null;
  const filteredAppointments = filterSet ? appointments.filter((a) => filterSet.has(a.personId)) : appointments;
  const sortedAppointments = [...filteredAppointments].sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">{t('appointments')}</h1>
        {canEdit && (
          <button
            onClick={() => { setIsSelectMode((m) => !m); if (isSelectMode) setSelectedIds(new Set()); }}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
              isSelectMode ? 'text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
            style={isSelectMode ? { backgroundColor: selectionColor } : undefined}
          >
            {isSelectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {t('plans_select_mode')}
          </button>
        )}
      </div>

      <PlansFilterBar people={people} />

      {selectedIds.size > 0 && (
        <div
          className="sticky top-20 z-30 flex items-center justify-between gap-4 p-4 rounded-2xl border shadow-lg"
          style={{ backgroundColor: `${selectionColor}15`, borderColor: `${selectionColor}40` }}
        >
          <span className="font-semibold text-stone-900">{t('plans_selected_count').replace('{count}', String(selectedIds.size))}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              {t('delete_selected')}
            </button>
            <button
              onClick={() => { setSelectedIds(new Set()); setIsSelectMode(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" />
              {t('plans_clear_selection')}
            </button>
          </div>
        </div>
      )}

      {sortedAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-stone-200 border-dashed text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-stone-900 mb-2">{t('no_appointments')}</h3>
          <p className="text-stone-500 max-w-sm">{t('add_appointment')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedAppointments.map((appointment) => {
            const person = getPerson(appointment.personId);
            if (!person) return null;

            const isDone = appointment.status === 'DONE';

            const isSelected = selectedIds.has(appointment.id);
            return (
              <div
                key={appointment.id}
                onClick={() => handleCardClick(appointment)}
                onTouchStart={() => handleCardTouchStart(appointment)}
                onTouchEnd={handleCardTouchEnd}
                onTouchCancel={handleCardTouchEnd}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(appointment)}
                className={`group flex flex-col sm:flex-row gap-4 p-5 bg-white rounded-2xl border shadow-sm transition-all relative overflow-hidden cursor-pointer hover:border-stone-300 ${
                  isDone ? 'opacity-60' : ''
                } ${isSelected ? 'border-2' : 'border-stone-200'}`}
                style={isSelected ? { borderColor: selectionColor } : undefined}
              >
                <div
                  className="absolute top-0 bottom-0 w-2 left-0"
                  style={{ backgroundColor: person.color }}
                />
                {isSelectMode && (
                  <div className="flex-shrink-0 flex items-center min-h-[44px] min-w-[44px]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(appointment.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-stone-300 cursor-pointer"
                      style={{ accentColor: selectionColor }}
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:items-center ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStatus(appointment, e); }}
                    disabled={!canEdit || isSelectMode}
                    className="flex-shrink-0 min-h-[44px] min-w-[44px] text-stone-400 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    ) : (
                      <Circle className="w-8 h-8" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <PersonAvatar person={person} size="sm" />
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: person.color }}
                      >
                        {person.name}
                      </span>
                      <h3 className={`text-lg font-semibold text-stone-900 ${isDone ? 'line-through' : ''}`}>
                        {appointment.title}
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          {format(appointment.start, 'PPp', { locale: dateLocale })} -{' '}
                          {format(appointment.end, 'p', { locale: dateLocale })}
                        </span>
                      </div>
                      
                      {appointment.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{appointment.location}</span>
                        </div>
                      )}
                    </div>

                    {appointment.notes && (
                      <div className="flex items-start gap-1 text-sm text-stone-600 mt-2 bg-stone-50 p-2 rounded-lg">
                        <AlignLeft className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-2">{appointment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {!isSelectMode && (
                <div className="flex items-center gap-2 sm:self-start justify-end sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAppointmentToDelete(appointment.id); }}
                    disabled={!canEdit}
                    className="p-2 min-h-[44px] min-w-[44px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PlanModal
        isOpen={!!editingAppointment}
        onClose={() => setEditingAppointment(null)}
        mode="edit"
        appointment={editingAppointment}
        people={people}
        selectedPersonId={null}
        onSave={handleSaveFromModal}
        onDelete={handleDeleteFromModal}
        canEdit={canEdit}
      />

      <ConfirmModal
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        onConfirm={handleDelete}
        title={t('delete')}
        message={t('confirm_delete_appointment')}
      />

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={t('delete')}
        message={t('confirm_delete_appointments')}
      />
    </div>
  );
};
