import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useFamily } from '../context/FamilyProvider';
import { PlanModal } from '../components/PlanModal';
import { useToast } from '../context/ToastProvider';
import { PersonAvatar } from '../components/PersonAvatar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Upload, Trash2, CheckCircle2, Circle, MapPin, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { formatTime24, formatDateTime24 } from '../lib/formatTime';
import { ConfirmModal } from '../components/ConfirmModal';
import { Appointment, AppointmentStatus, Attachment } from '../types/models';

export const PersonDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language, dir } = useI18n();
  const { canEdit } = useAuth();
  const { people, appointments, attachments, updateAppointment, deleteAppointment, addAttachment, deleteAttachment, deleteAttachments } = useData();
  const { showToast } = useToast();
  const { selectionColor } = useFamily();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'documents'>('upcoming');
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [addDocsMenuOpen, setAddDocsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const person = people.find((p) => p.id === id);
  const dateLocale = language === 'he' ? he : enUS;
  const timeLocale = language === 'he' ? 'he-IL' : 'en-GB';

  if (!person) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">{t('no_person_selected')}</p>
        <button
          onClick={() => navigate('/people')}
          className="mt-4 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors"
        >
          {t('back')}
        </button>
      </div>
    );
  }

  const personAppointments = appointments.filter((a) => a.personId === id);
  const now = Date.now();
  const upcomingAppointments = personAppointments.filter((a) => a.start >= now).sort((a, b) => a.start - b.start);
  const pastAppointments = personAppointments.filter((a) => a.start < now).sort((a, b) => b.start - a.start);
  
  // Get all attachments for this person's appointments
  const personAppointmentIds = personAppointments.map(a => a.id);
  const personAttachments = attachments.filter(a => personAppointmentIds.includes(a.appointmentId));

  const toggleStatus = async (appointmentId: string, currentStatus: AppointmentStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: AppointmentStatus = currentStatus === 'PLANNED' ? 'DONE' : 'PLANNED';
    await updateAppointment(appointmentId, { status: newStatus });
    showToast(t('appointment_updated'), 'success');
  };

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

  const handleDeleteAppointment = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (appointmentToDelete) {
      await deleteAppointment(appointmentToDelete);
      showToast(t('appointment_deleted'), 'success');
      setAppointmentToDelete(null);
    }
  };

  const handleDeleteDocument = () => {
    if (documentToDelete) {
      deleteAttachment(documentToDelete);
      showToast(t('document_deleted'), 'success');
      setDocumentToDelete(null);
      setSelectedDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentToDelete);
        return newSet;
      });
    }
  };

  const handleBulkDeleteDocuments = () => {
    if (selectedDocuments.size > 0) {
      deleteAttachments(Array.from(selectedDocuments));
      showToast(t('document_deleted'), 'success');
      setSelectedDocuments(new Set());
      setIsBulkDeleteModalOpen(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.size === personAttachments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(personAttachments.map(a => a.id)));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetAppointmentId = personAppointments.length > 0 ? personAppointments[0].id : 'dummy-id';

    Array.from(files).forEach((file: File) => {
      addAttachment({
        appointmentId: targetAppointmentId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploaderId: 'current-user',
      });
    });

    showToast(t('document_added'), 'success');
    setAddDocsMenuOpen(false);
    if (e.target) e.target.value = '';
  };

  const triggerFileSelect = () => {
    setAddDocsMenuOpen(false);
    fileInputRef.current?.click();
  };

  const triggerCameraCapture = () => {
    setAddDocsMenuOpen(false);
    cameraInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderAppointmentList = (list: typeof upcomingAppointments) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-stone-200 border-dashed text-center">
          <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-1">{t('no_appointments')}</h3>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {list.map((appointment) => {
          const isDone = appointment.status === 'DONE';
          return (
            <div
              key={appointment.id}
              onClick={() => setEditingAppointment(appointment)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setEditingAppointment(appointment)}
              className={`group flex flex-col sm:flex-row gap-4 p-5 bg-white rounded-2xl border border-stone-200 shadow-sm transition-all relative overflow-hidden cursor-pointer hover:border-stone-300 ${
                isDone ? 'opacity-60' : ''
              }`}
            >
              <div
                className="absolute top-0 bottom-0 w-2 left-0"
                style={{ backgroundColor: person.color }}
              />
              
              <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:items-center ml-2">
                <button
                  onClick={(e) => toggleStatus(appointment.id, appointment.status, e)}
                  disabled={!canEdit}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px] text-stone-400 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <Circle className="w-8 h-8" />
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <h3 className={`text-lg font-semibold text-stone-900 ${isDone ? 'line-through' : ''}`}>
                    {appointment.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {formatDateTime24(new Date(appointment.start), timeLocale)} -{' '}
                        {formatTime24(new Date(appointment.end), timeLocale)}
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

              <div className="flex items-center gap-2 sm:self-start justify-end sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); setAppointmentToDelete(appointment.id); }}
                  disabled={!canEdit}
                  className="p-2 min-h-[44px] min-w-[44px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/people')}
          className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"
        >
          {dir === 'rtl' ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-4">
          <PersonAvatar person={person} size="lg" />
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{person.name}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
          }`}
        >
          {t('upcoming')} ({upcomingAppointments.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'past'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
          }`}
        >
          {t('past')} ({pastAppointments.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'documents'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
          }`}
        >
          {t('documents')} ({personAttachments.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'upcoming' && renderAppointmentList(upcomingAppointments)}
        {activeTab === 'past' && renderAppointmentList(pastAppointments)}
        
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-500">{t('docs_counter').replace('{used}', String(attachments.length))}</span>
                {canEdit ? (
                  <div className="relative">
                    <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                    <button
                      type="button"
                      onClick={() => setAddDocsMenuOpen((o) => !o)}
                      className="flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-white rounded-xl hover:opacity-90 transition-opacity shadow-sm font-medium"
                      style={{ backgroundColor: selectionColor }}
                    >
                      <Upload className="w-5 h-5" />
                      <span>{t('docs_add_documents')}</span>
                    </button>
                    {addDocsMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setAddDocsMenuOpen(false)} aria-hidden="true" />
                        <div className={`absolute top-full mt-2 z-50 min-w-[200px] py-2 bg-white rounded-xl border border-stone-200 shadow-lg ${dir === 'rtl' ? 'right-0 left-auto' : 'left-0'}`}>
                          <button
                            type="button"
                            onClick={triggerFileSelect}
                            className="w-full px-4 py-3 min-h-[44px] text-left text-stone-700 hover:bg-stone-50 transition-colors font-medium flex items-center gap-2"
                          >
                            <FileText className="w-5 h-5" />
                            {t('docs_select_from_device')}
                          </button>
                          <button
                            type="button"
                            onClick={triggerCameraCapture}
                            className="w-full px-4 py-3 min-h-[44px] text-left text-stone-700 hover:bg-stone-50 transition-colors font-medium flex items-center gap-2"
                          >
                            <Upload className="w-5 h-5" />
                            {t('docs_capture_now')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {personAttachments.length > 0 && canEdit && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors min-h-[44px] flex items-center"
                  >
                    {selectedDocuments.size === personAttachments.length ? t('cancel') : t('select_all')}
                  </button>
                  {selectedDocuments.size > 0 && (
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 min-h-[44px] bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('delete_selected')} ({selectedDocuments.size})</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {personAttachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-stone-200 border-dashed text-center">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-medium text-stone-900 mb-1">{t('no_documents')}</h3>
                <p className="text-stone-500 max-w-sm">{t('upload_document')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personAttachments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-start gap-3 p-4 bg-white rounded-2xl border transition-all ${
                      canEdit ? 'cursor-pointer' : 'cursor-default'
                    } ${selectedDocuments.has(doc.id) ? 'ring-1' : 'border-stone-200 hover:border-stone-300'}`}
                    style={selectedDocuments.has(doc.id) ? { borderColor: selectionColor, boxShadow: `0 0 0 1px ${selectionColor}`, backgroundColor: `${selectionColor}15` } : {}}
                    onClick={() => canEdit && toggleDocumentSelection(doc.id)}
                  >
                    <div className="flex-shrink-0 pt-1">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        selectedDocuments.has(doc.id) ? 'text-white' : 'border-stone-300 bg-white'
                      }`}
                        style={selectedDocuments.has(doc.id) ? { backgroundColor: selectionColor, borderColor: selectionColor } : {}}
                      >
                        {selectedDocuments.has(doc.id) && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-stone-900 truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canEdit) setDocumentToDelete(doc.id);
                          }}
                          disabled={!canEdit}
                          className="p-1 min-h-[44px] min-w-[44px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                        <span className="truncate max-w-[80px]">{doc.type.split('/')[1] || 'File'}</span>
                        <span>{formatFileSize(doc.size)}</span>
                        <span>{format(doc.createdAt, 'MMM d, yyyy', { locale: dateLocale })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
        onConfirm={() => handleDeleteAppointment()}
        title={t('delete')}
        message={t('confirm_delete_appointment')}
      />

      <ConfirmModal
        isOpen={!!documentToDelete}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={handleDeleteDocument}
        title={t('delete')}
        message={t('confirm_delete_document')}
      />

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteDocuments}
        title={t('delete_selected')}
        message={t('confirm_delete_documents')}
      />
    </div>
  );
};
