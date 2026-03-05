import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useUserRole } from '../context/UserRoleProvider';
import { driveGetPersonPhotoUrl } from '../lib/drive';
import { X, Settings } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { email, isConnected, canEdit } = useAuth();
  const { userProfilePhotoFileId, updateProfilePhoto } = useUserRole();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userProfilePhotoFileId || !isConnected) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    driveGetPersonPhotoUrl(userProfilePhotoFileId)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userProfilePhotoFileId, isConnected]);

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await updateProfilePhoto(pendingFile);
      setPendingFile(null);
      onClose();
    } catch (e) {
      console.warn('Profile photo update failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = () => {
    setPendingFile(null);
    updateProfilePhoto(null).then(() => onClose()).catch(console.warn);
  };

  if (!isOpen) return null;

  const displayUrl = pendingFile ? URL.createObjectURL(pendingFile) : photoUrl;
  const initial = email ? email.charAt(0).toUpperCase() : '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="flex justify-between items-center p-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">{t('profile_title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden">
              {displayUrl ? (
                <img src={displayUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-stone-400">{initial}</span>
              )}
            </div>
            {email && (
              <p className="text-sm text-stone-500 truncate max-w-full px-4" dir="ltr">{email}</p>
            )}
          </div>
          {canEdit && isConnected ? (
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer font-medium transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingFile(f);
                    e.target.value = '';
                  }}
                />
                {t('profile_upload_photo')}
              </label>
              {(displayUrl || userProfilePhotoFileId) && (
                <button
                  type="button"
                  onClick={() => pendingFile ? setPendingFile(null) : handleRemove()}
                  className="px-4 py-3 min-h-[44px] rounded-xl text-red-600 hover:bg-red-50 font-medium transition-colors"
                >
                  {t('profile_remove_photo')}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500 text-center">{t('profile_connect_required')}</p>
          )}
          <button
            type="button"
            onClick={() => { onClose(); navigate('/settings#family-profile'); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium transition-colors"
          >
            <Settings className="w-5 h-5" />
            {t('family_profile_title')}
          </button>
        </div>
        {canEdit && pendingFile && (
          <div className="p-4 border-t border-stone-100 flex justify-end gap-3">
            <button onClick={() => setPendingFile(null)} className="px-4 py-3 font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
