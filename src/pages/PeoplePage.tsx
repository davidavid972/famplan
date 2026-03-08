import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useTheme } from '../context/ThemeContext';
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

const AVATAR_EMOJIS = ['👨', '👩', '👦', '👧', '🧒', '👴', '👵', '👶', '🧑', '👤', '👷', '👩‍🍳', '👨‍💼', '👩‍💼', '🧑‍🎓', '👨‍⚕️', '👩‍⚕️'];

const PEOPLE_PHOTOS_FOLDER_KEY = 'famplan_drive_people_photos_folder_id';

export const PeoplePage: React.FC = () => {
  const { t, dir } = useI18n();
  const { canEdit, isConnected } = useAuth();
  const { activeTheme } = useTheme();
  const isDefaultDesign = activeTheme === 'default';
  const { people, appointments, addPerson, updatePerson, deletePerson } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState(AVATAR_EMOJIS[0]);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setName(person.name);
      setColor(person.color);
      setEmoji(person.emoji || AVATAR_EMOJIS[people.indexOf(person) % AVATAR_EMOJIS.length]);
    } else {
      setEditingPerson(null);
      setName('');
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setEmoji(AVATAR_EMOJIS[people.length % AVATAR_EMOJIS.length]);
    }
    setPendingPhotoFile(null);
    setRemovePhoto(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPerson(null);
    setName('');
    setEmoji(AVATAR_EMOJIS[0]);
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
      updatePerson(editingPerson.id, { name, color, emoji, photoFileId: photoFileId ?? undefined });
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
      const added = addPerson({ name, color, emoji });
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('people_title')}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t('people_subtitle')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          disabled={!canEdit}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('add_person')}</span>
        </button>
      </motion.div>

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-3xl border border-border border-dashed text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">{t('no_people')}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">{t('add_first_person')}</p>
          <button
            onClick={() => handleOpenModal()}
            disabled={!canEdit}
            className="px-6 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {t('add_person')}
          </button>
        </div>
      ) : (
        <div className={isDefaultDesign ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {people.map((person, i) => {
            const personAppointments = (appointments ?? []).filter((a) => a?.personId === person.id);
            const eventsCount = personAppointments.filter((a) => a?.status === 'DONE').length;
            const tasksCount = personAppointments.filter((a) => a?.status === 'PLANNED').length;
            return (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                onClick={() => navigate(`/people/${person.id}`)}
                className={`group flex items-center gap-4 p-4 pt-5 theme-surface hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden ${isDefaultDesign ? 'flex-row' : 'flex-col sm:flex-row sm:items-center'}`}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: person.color }}
                />
                {/* Edit/Delete - fixed top-end corner, no overlap with content */}
                <div
                  className="absolute top-2 end-2 flex items-center gap-0.5 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleOpenModal(person)}
                    disabled={!canEdit}
                    className="p-1.5 min-h-[36px] min-w-[36px] text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPersonToDelete(person.id)}
                    disabled={!canEdit}
                    className="p-1.5 min-h-[36px] min-w-[36px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <PersonAvatar person={person} size="md" className={`shrink-0 ${isDefaultDesign ? 'w-14 h-14 text-2xl' : 'mt-1'}`} />
                <div className="flex-1 min-w-0 pe-16">
                  <h3 className="text-base font-semibold text-foreground truncate">{person.name}</h3>
                </div>
                <div className="flex gap-4 text-center shrink-0">
                  <div>
                    <p className="text-lg font-bold text-foreground">{eventsCount}</p>
                    <p className="text-[10px] text-muted-foreground">{t('stats_events')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{tasksCount}</p>
                    <p className="text-[10px] text-muted-foreground">{t('stats_tasks')}</p>
                  </div>
                </div>
                <div className="flex items-center text-primary font-medium text-sm shrink-0">
                  {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="bg-card rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">
                {editingPerson ? t('edit_person') : t('add_person')}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('person_photo_label')}
                </label>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 text-3xl" style={{ border: `2px solid ${color}`, backgroundColor: `${color}20` }}>
                    {pendingPhotoFile ? (
                      <img src={URL.createObjectURL(pendingPhotoFile)} alt="" className="w-full h-full object-cover" />
                    ) : editingPerson && !removePhoto && editingPerson.photoFileId ? (
                      <PersonAvatar person={{ ...editingPerson, color }} size="lg" />
                    ) : (
                      <span>{emoji}</span>
                    )}
                  </div>
                  {canEdit && isConnected ? (
                    <label className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted cursor-pointer font-medium">
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
                    <p className="text-sm text-muted-foreground">{t('person_photo_connect_required')}</p>
                  )}
                  {(pendingPhotoFile || (editingPerson?.photoFileId && !removePhoto)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPhotoFile(null);
                        setRemovePhoto(!!editingPerson?.photoFileId);
                      }}
                      className="min-h-[44px] px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-xl font-medium"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('person_avatar_label')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform hover:scale-110 ${
                        emoji === e ? 'ring-2 ring-offset-2 ring-primary scale-110 bg-primary/10' : 'bg-muted hover:bg-secondary'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted focus:bg-card"
                  placeholder={t('name')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('color')}
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 bg-muted border-t border-border">
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 font-medium text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white bg-primary rounded-xl hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
