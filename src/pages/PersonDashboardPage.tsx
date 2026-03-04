import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Upload, Trash2, CheckCircle2, Circle, MapPin, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { ConfirmModal } from '../components/ConfirmModal';
import { AppointmentStatus, Attachment } from '../types/models';

export const PersonDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language, dir } = useI18n();
  const { people, appointments, attachments, updateAppointment, deleteAppointment, addAttachment, deleteAttachment, deleteAttachments } = useData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'documents'>('upcoming');
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const person = people.find((p) => p.id === id);
  const dateLocale = language === 'he' ? he : enUS;

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

  const toggleStatus = (appointmentId: string, currentStatus: AppointmentStatus) => {
    const newStatus: AppointmentStatus = currentStatus === 'PLANNED' ? 'DONE' : 'PLANNED';
    updateAppointment(appointmentId, { status: newStatus });
    showToast(t('appointment_updated'), 'success');
  };

  const handleDeleteAppointment = () => {
    if (appointmentToDelete) {
      deleteAppointment(appointmentToDelete);
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

    if (attachments.length + files.length > 20) {
      showToast(t('documents_limit_reached'), 'error');
      return;
    }

    // For demo, we just add the first appointment we find, or a dummy one if none exists
    const targetAppointmentId = personAppointments.length > 0 ? personAppointments[0].id : 'dummy-id';

    Array.from(files).forEach((file: File) => {
      addAttachment({
        appointmentId: targetAppointmentId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploaderId: 'current-user', // placeholder
      });
    });

    showToast(t('document_added'), 'success');
    if (e.target) {
      e.target.value = '';
    }
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
              className={`group flex flex-col sm:flex-row gap-4 p-5 bg-white rounded-2xl border border-stone-200 shadow-sm transition-all relative overflow-hidden ${
                isDone ? 'opacity-60' : ''
              }`}
            >
              <div
                className="absolute top-0 bottom-0 w-2 left-0"
                style={{ backgroundColor: person.color }}
              />
              
              <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:items-center ml-2">
                <button
                  onClick={() => toggleStatus(appointment.id, appointment.status)}
                  className="flex-shrink-0 text-stone-400 hover:text-emerald-600 transition-colors"
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

              <div className="flex items-center gap-2 sm:self-start justify-end sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setAppointmentToDelete(appointment.id)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
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
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-sm"
            style={{ backgroundColor: person.color }}
          >
            {person.name.charAt(0).toUpperCase()}
          </div>
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
                <span className="text-sm text-stone-500">{t('docs_usage').replace('{used}', String(personAttachments.length)).replace('{max}', '20')}</span>
                {personAttachments.length >= 20 ? (
                  <span className="text-sm text-amber-600">{t('documents_limit_reached')}</span>
                ) : (
                  <>
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium cursor-pointer">
                      <Upload className="w-5 h-5" />
                      <span>{t('upload_files')}</span>
                      <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                    </label>
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm font-medium cursor-pointer">
                      <FileText className="w-5 h-5" />
                      <span>{t('camera_capture')}</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </>
                )}
              </div>

              {personAttachments.length > 0 && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    {selectedDocuments.size === personAttachments.length ? t('cancel') : t('select_all')}
                  </button>
                  {selectedDocuments.size > 0 && (
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
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
                    className={`flex items-start gap-3 p-4 bg-white rounded-2xl border transition-all cursor-pointer ${
                      selectedDocuments.has(doc.id) ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : 'border-stone-200 hover:border-stone-300'
                    }`}
                    onClick={() => toggleDocumentSelection(doc.id)}
                  >
                    <div className="flex-shrink-0 pt-1">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        selectedDocuments.has(doc.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 bg-white'
                      }`}>
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
                            setDocumentToDelete(doc.id);
                          }}
                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
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

      <ConfirmModal
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        onConfirm={handleDeleteAppointment}
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
