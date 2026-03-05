import React, { useState, useCallback } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useFamily } from '../context/FamilyProvider';
import { useToast } from '../context/ToastProvider';
import { PlanModal } from '../components/PlanModal';
import { PlansFilterBar } from '../components/PlansFilterBar';
import { PersonAvatar } from '../components/PersonAvatar';
import { Calendar as CalendarIcon, MapPin, AlignLeft, CheckCircle2, Circle, Trash2, X } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Appointment, AppointmentStatus } from '../types/models';
import { formatTime24, formatDateTime24 } from '../lib/formatTime';

export const AppointmentsPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { canEdit } = useAuth();
  const { planFilterPersonIds, selectionColor } = useFamily();
  const { appointments, people, updateAppointment, deleteAppointment, deleteAppointments, deleteAppointmentsByRecurrenceGroupId } = useData();
  const { showToast } = useToast();

  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const timeLocale = language === 'he' ? 'he-IL' : 'en-GB';
  const safeFormatDateTime = (ts: number | undefined) => {
    const val = ts ?? 0;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return formatDateTime24(d, timeLocale);
  };
  const safeFormatTime = (ts: number | undefined) => {
    const val = ts ?? 0;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return formatTime24(d, timeLocale);
  };

  const getPerson = (id: string) => people.find((p) => p && p.id === id);

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
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      await deleteAppointments(Array.from(selectedIds));
      showToast(t('plans_deleted_count').replace('{count}', String(count)), 'success');
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`${t('delete_selected')}: ${msg}`, 'error');
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

  const handleCardClick = useCallback((appointment: Appointment) => {
    setEditingAppointment(appointment);
  }, []);

  const handleCircleClick = useCallback((appointment: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(appointment.id);
  }, [toggleSelection]);

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

  const handleDeleteSeriesFromModal = async (recurrenceGroupId: string) => {
    await deleteAppointmentsByRecurrenceGroupId(recurrenceGroupId);
    showToast(t('appointment_deleted'), 'success');
    setEditingAppointment(null);
  };

  // Filter by people (multi-select); guard against invalid appointments
  const safeAppointments = Array.isArray(appointments) ? appointments : [];
  const filterSet = planFilterPersonIds && planFilterPersonIds.length > 0 ? new Set(planFilterPersonIds) : null;
  const filteredAppointments = filterSet ? safeAppointments.filter((a) => a && filterSet.has(a.personId)) : safeAppointments;
  const sortedAppointments = [...filteredAppointments].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedAppointments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedAppointments.map((a) => a.id)));
    }
  }, [selectedIds.size, sortedAppointments]);

  return (
    <div
      className={`space-y-6 animate-in fade-in duration-300 ${selectedIds.size > 0 ? 'plans-page-with-selection sm:pt-24' : ''}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">{t('appointments')}</h1>
      </div>

      <PlansFilterBar people={Array.isArray(people) ? people.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : []} />

      {selectedIds.size > 0 && (
        <div
          className="plans-selection-bar fixed left-0 right-0 z-40 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border shadow-lg sm:rounded-b-none sm:rounded-t-2xl border-t border-x max-h-[calc(100vh-4rem-env(safe-area-inset-bottom)-24px)] overflow-y-auto sm:max-h-none sm:overflow-visible"
          style={{
            backgroundColor: `${selectionColor}18`,
            borderColor: `${selectionColor}40`,
          }}
        >
          <span className="font-semibold text-stone-900 shrink-0">{t('plans_selected_count').replace('{count}', String(selectedIds.size))}</span>
          <div className="flex flex-wrap gap-2 justify-end sm:justify-end">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 transition-colors min-h-[44px]"
            >
              {t('select_all')}
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              {t('plans_delete_selected_with_count').replace('{count}', String(selectedIds.size))}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
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
        <div className="space-y-3">
          {sortedAppointments.map((appointment) => {
            const person = getPerson(appointment.personId);
            if (!person) return null;

            const isDone = appointment.status === 'DONE';

            const isSelected = selectedIds.has(appointment.id);
            return (
              <div
                key={appointment.id}
                onClick={() => handleCardClick(appointment)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(appointment)}
                className={`group flex flex-col sm:flex-row gap-3 p-4 bg-white rounded-xl border shadow-sm transition-all relative overflow-hidden cursor-pointer hover:border-stone-300 md:hover:shadow-md ${
                  isDone ? 'opacity-60' : ''
                } ${isSelected ? 'border-2' : 'border-stone-200'}`}
                style={isSelected ? { borderColor: selectionColor } : undefined}
              >
                <div
                  className="absolute top-0 bottom-0 w-1 left-0 rtl:left-auto rtl:right-0"
                  style={{ backgroundColor: person.color }}
                />
                {canEdit && (
                  <button
                    onClick={(e) => handleCircleClick(appointment, e)}
                    className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors border-2 self-center sm:self-start mt-0.5"
                    style={{
                      backgroundColor: isSelected ? selectionColor : 'transparent',
                      borderColor: isSelected ? selectionColor : 'rgb(214 211 209)',
                      color: isSelected ? 'white' : 'rgb(120 113 108)',
                    }}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                )}
                <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center min-w-0 ms-1 sm:ms-0">

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-base font-semibold text-stone-900 ${isDone ? 'line-through' : ''}`}>
                        {appointment.title}
                      </h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                        style={{ backgroundColor: person.color }}
                      >
                        {person.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {safeFormatTime(appointment.start)}–{safeFormatTime(appointment.end)}
                          <span className="ms-1 opacity-80">
                            {new Date(appointment.start).toLocaleDateString(timeLocale, { day: 'numeric', month: 'short' })}
                          </span>
                        </span>
                      </div>
                      {appointment.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[180px]">{appointment.location}</span>
                        </div>
                      )}
                    </div>

                    {appointment.notes && (
                      <div className="flex items-start gap-1 text-xs text-stone-600 mt-1.5 bg-stone-50 px-2 py-1.5 rounded-lg">
                        <AlignLeft className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-2">{appointment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedIds.size === 0 && (
                <div className="flex items-center gap-1 sm:self-center justify-end sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAppointmentToDelete(appointment.id); }}
                    disabled={!canEdit}
                    className="p-1.5 min-h-[36px] min-w-[36px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
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
        onDeleteSeries={handleDeleteSeriesFromModal}
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
        message={t('confirm_delete_plans_count').replace('{count}', String(selectedIds.size))}
        confirmText={t('delete')}
        cancelText={t('cancel')}
      />
    </div>
  );
};
