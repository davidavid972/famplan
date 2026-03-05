import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { PersonAvatar } from '../components/PersonAvatar';
import { driveUploadPersonPhoto } from '../lib/drive';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Users, Loader2 } from 'lucide-react';

const normalizeName = (s: string) => s.trim().toLowerCase();
import { ConfirmModal } from '../components/ConfirmModal';
import { Person } from '../types/models';
import { useNavigate } from 'react-router-dom';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

const PEOPLE_PHOTOS_FOLDER_KEY = 'famplan_drive_people_photos_folder_id';

export const PeoplePage: React.FC = () => {
  const { t, dir } = useI18n();
  const { canEdit, isConnected } = useAuth();
  const { people, addPerson, updatePerson, deletePerson } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = (person?: Person) => {
    if (!person && people.length >= 3) {
      showToast(t('limit_reached'), 'error');
      return;
    }
    if (person) {
      setEditingPerson(person);
      setName(person.name);
      setColor(person.color);
    } else {
      setEditingPerson(null);
      setName('');
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    setPendingPhotoFile(null);
    setRemovePhoto(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPerson(null);
    setName('');
    setPendingPhotoFile(null);
    setRemovePhoto(false);
    setIsSaving(false);
  };

  const handleSave = () => {
    if (isSaving) return;
    if (!name.trim()) return;

    const normalized = normalizeName(name);
    const isDuplicate = people.some(
      (p) => p.id !== editingPerson?.id && normalizeName(p.name) === normalized
    );
    if (isDuplicate) {
      showToast(t('person_already_exists'), 'error');
      return;
    }

    const needsPhotoUpload = pendingPhotoFile && isConnected && canEdit;
    if (needsPhotoUpload) {
      const folderId = localStorage.getItem(PEOPLE_PHOTOS_FOLDER_KEY);
      if (!folderId) {
        window.dispatchEvent(new CustomEvent('famplan-drive-sync-request'));
        showToast(t('person_photo_sync_required'), 'error');
        return;
      }
    }

    setIsSaving(true);

    if (editingPerson) {
      const prevPhotoFileId = editingPerson.photoFileId;
      const photoFileId = removePhoto ? null : prevPhotoFileId;
      updatePerson(editingPerson.id, { name, color, photoFileId: photoFileId ?? undefined });
      handleCloseModal();
      showToast(t('saved'), 'success');

      if (needsPhotoUpload) {
        const folderId = localStorage.getItem(PEOPLE_PHOTOS_FOLDER_KEY)!;
        driveUploadPersonPhoto(pendingPhotoFile!, editingPerson.id, folderId)
          .then((newPhotoFileId) => {
            updatePerson(editingPerson.id, { photoFileId: newPhotoFileId });
          })
          .catch(() => {
            showToast(t('save_failed'), 'error');
            updatePerson(editingPerson.id, { photoFileId: prevPhotoFileId ?? undefined });
          });
      }
    } else {
      const added = addPerson({ name, color });
      handleCloseModal();
      showToast(t('saved'), 'success');

      if (needsPhotoUpload) {
        const folderId = localStorage.getItem(PEOPLE_PHOTOS_FOLDER_KEY)!;
        driveUploadPersonPhoto(pendingPhotoFile!, added.id, folderId)
          .then((photoFileId) => {
            updatePerson(added.id, { photoFileId });
          })
          .catch(() => {
            showToast(t('save_failed'), 'error');
            deletePerson(added.id);
          });
      }
    }
  };

  const handleDelete = () => {
    if (personToDelete) {
      deletePerson(personToDelete);
      showToast(t('person_deleted'), 'success');
      setPersonToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">{t('people')}</h1>
        <button
          onClick={() => handleOpenModal()}
          disabled={!canEdit}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('add_person')}</span>
        </button>
      </div>

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-stone-200 border-dashed text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-stone-900 mb-2">{t('no_people')}</h3>
          <p className="text-stone-500 mb-6 max-w-sm">{t('add_first_person')}</p>
          <button
            onClick={() => handleOpenModal()}
            disabled={!canEdit}
            className="px-6 py-3 min-h-[44px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
          >
            {t('add_person')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <div
              key={person.id}
              onClick={() => navigate(`/people/${person.id}`)}
              className="group flex flex-col p-6 bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-2"
                style={{ backgroundColor: person.color }}
              />
              <div className="flex items-start justify-between mt-2">
                <div className="flex items-center gap-4">
                      <PersonAvatar person={person} size="md" />
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">{person.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenModal(person)}
                    disabled={!canEdit}
                    className="p-2 min-h-[44px] min-w-[44px] text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPersonToDelete(person.id)}
                    disabled={!canEdit}
                    className="p-2 min-h-[44px] min-w-[44px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-6 flex items-center text-emerald-600 font-medium text-sm self-end">
                {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-900">
                {editingPerson ? t('edit_person') : t('add_person')}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t('person_photo_label')}
                </label>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-stone-100">
                    {pendingPhotoFile ? (
                      <img src={URL.createObjectURL(pendingPhotoFile)} alt="" className="w-full h-full object-cover" />
                    ) : editingPerson && !removePhoto ? (
                      <PersonAvatar person={editingPerson} size="lg" />
                    ) : (
                      <span className="text-2xl font-bold text-stone-400">?</span>
                    )}
                  </div>
                  {canEdit && isConnected ? (
                    <label className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-600 hover:bg-stone-50 cursor-pointer font-medium">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPendingPhotoFile(f);
                            setRemovePhoto(false);
                          }
                          e.target.value = '';
                        }}
                      />
                      {pendingPhotoFile || (editingPerson?.photoFileId && !removePhoto) ? t('person_photo_change') : t('person_photo_upload')}
                    </label>
                  ) : (
                    <p className="text-sm text-stone-500">{t('person_photo_connect_required')}</p>
                  )}
                  {(pendingPhotoFile || (editingPerson?.photoFileId && !removePhoto)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPhotoFile(null);
                        setRemovePhoto(!!editingPerson?.photoFileId);
                      }}
                      className="min-h-[44px] px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl font-medium"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t('name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                  placeholder={t('name')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t('color')}
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 bg-stone-50 border-t border-stone-100">
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('save')}</span>
                  </>
                ) : (
                  t('save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!personToDelete}
        onClose={() => setPersonToDelete(null)}
        onConfirm={handleDelete}
        title={t('delete_person')}
        message={t('confirm_delete_person')}
      />
    </div>
  );
};
