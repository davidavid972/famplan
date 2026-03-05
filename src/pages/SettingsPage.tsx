import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useFamily } from '../context/FamilyProvider';
import { useToast } from '../context/ToastProvider';
import { cacheClear } from '../lib/cache';
import { Settings, Share2, Shield, HardDrive, Calendar as CalendarIcon, Pencil, X } from 'lucide-react';
import { FamilySharingModal } from '../components/FamilySharingModal';
import { CalendarModal } from '../components/CalendarModal';

const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const FILE_ID_KEY = 'famplan_drive_family_file_id';
const SYNC_STATUS_KEY = 'famplan_drive_sync_status';
const SYNC_PEOPLE_KEY = 'famplan_drive_sync_people';
const SYNC_APPOINTMENTS_KEY = 'famplan_drive_sync_appointments';
const SYNC_INDEX_KEY = 'famplan_drive_sync_index';

export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const { isConnected, canEdit, email, connect, disconnect, connectError, clearConnectError } = useAuth();
  const { showToast } = useToast();
  const { familyDisplayName, familyPhoto, selectionColor, setFamilyDisplayName, setFamilyPhoto, setSelectionColor } = useFamily();
  const [isConnecting, setIsConnecting] = useState(false);
  const [driveDebug, setDriveDebug] = useState({ rootFolderId: '', dataFolderId: '', familyFileId: '', syncStatus: '' });
  const [dataSyncTimes, setDataSyncTimes] = useState({ people: '', appointments: '', index: '' });
  const [isFamilyEditMode, setIsFamilyEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [driveSyncModalOpen, setDriveSyncModalOpen] = useState(false);
  const [comingSoonModalOpen, setComingSoonModalOpen] = useState(false);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [sharingModalMode, setSharingModalMode] = useState<'sharing' | 'roles'>('sharing');
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const authSectionRef = useRef<HTMLDivElement>(null);

  const refreshDriveDebug = () => {
    setDriveDebug({
      rootFolderId: localStorage.getItem(ROOT_FOLDER_KEY) || '',
      dataFolderId: localStorage.getItem(DATA_FOLDER_KEY) || '',
      familyFileId: localStorage.getItem(FILE_ID_KEY) || '',
      syncStatus: localStorage.getItem(SYNC_STATUS_KEY) || '',
    });
    setDataSyncTimes({
      people: localStorage.getItem(SYNC_PEOPLE_KEY) || '',
      appointments: localStorage.getItem(SYNC_APPOINTMENTS_KEY) || '',
      index: localStorage.getItem(SYNC_INDEX_KEY) || '',
    });
  };

  useEffect(() => {
    if (!isConnected) return;
    refreshDriveDebug();
    const handler = () => refreshDriveDebug();
    window.addEventListener('famplan-drive-sync-done', handler);
    window.addEventListener('famplan-drive-data-sync-done', handler);
    return () => {
      window.removeEventListener('famplan-drive-sync-done', handler);
      window.removeEventListener('famplan-drive-data-sync-done', handler);
    };
  }, [isConnected]);

  useEffect(() => {
    if (!canEdit && isFamilyEditMode) {
      setIsFamilyEditMode(false);
    }
  }, [canEdit, isFamilyEditMode]);

  useEffect(() => {
    if (location.hash === '#family-profile') {
      document.getElementById('family-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const handleConnect = async () => {
    setIsConnecting(true);
    clearConnectError();
    try {
      await connect();
    } finally {
      setIsConnecting(false);
    }
  };

  const startFamilyEdit = () => {
    setEditName(familyDisplayName);
    setEditPhoto(familyPhoto);
    setIsFamilyEditMode(true);
  };

  const saveFamilyEdit = () => {
    setFamilyDisplayName(editName);
    setFamilyPhoto(editPhoto);
    setIsFamilyEditMode(false);
  };

  const cancelFamilyEdit = () => {
    setEditName(familyDisplayName);
    setEditPhoto(familyPhoto);
    setIsFamilyEditMode(false);
  };

  const handleDriveCardClick = () => {
    if (isConnected) {
      refreshDriveDebug();
      setDriveSyncModalOpen(true);
    } else {
      authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      authSectionRef.current?.focus();
    }
  };

  const handleSyncNow = () => {
    window.dispatchEvent(new CustomEvent('famplan-drive-sync-request'));
    refreshDriveDebug();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">{t('settings_title')}</h1>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
            <Settings className="w-10 h-10 text-stone-400" />
          </div>
          
          <div className="max-w-md mx-auto space-y-2 text-center">
            <h2 className="text-xl font-semibold text-stone-900">
              {t('settings_subtitle')}
            </h2>
            <p className="text-stone-500 text-sm">
              {t('settings_reserved_area')}
            </p>
          </div>

          {/* Connected profile - top section, mobile-first */}
          <div ref={authSectionRef} className="w-full pt-4" tabIndex={-1}>
            <h3 className="text-sm font-medium text-stone-700 mb-3">{t('auth_profile')}</h3>
            <div className="w-full p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
              {isConnected ? (
                <>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white text-stone-700"
                    dir="ltr"
                  />
                  <button
                    onClick={disconnect}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors border border-red-200"
                  >
                    {t('auth_disconnect')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors font-medium text-stone-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>{isConnecting ? t('auth_connecting') : t('auth_connect_google')}</span>
                  </button>
                  {connectError && (
                    <p className="text-sm text-red-600">{t('auth_connect_error')}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Family profile - locked or edit mode */}
          <div id="family-profile" className="w-full pt-4 scroll-mt-24">
            <h3 className="text-sm font-medium text-stone-700 mb-3">{t('family_profile_title')}</h3>
            <div className="w-full p-4 sm:p-5 bg-stone-100 rounded-2xl border border-stone-200 space-y-4">
              {isFamilyEditMode && canEdit ? (
                /* Edit mode */
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('family_name_placeholder')}
                    className="w-full px-4 py-3 min-h-[44px] rounded-xl border border-stone-200 text-sm bg-white"
                  />
                  <div>
                    <label className="block text-xs text-stone-500 mb-2">{t('family_photo_label')}</label>
                    <div className="flex items-center gap-3 w-full">
                      {editPhoto && (
                        <img src={editPhoto} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                      )}
                      <label className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-600 hover:bg-stone-50 cursor-pointer font-medium">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const r = new FileReader();
                              r.onload = () => setEditPhoto(r.result as string);
                              r.readAsDataURL(f);
                            }
                            e.target.value = '';
                          }}
                        />
                        {editPhoto ? t('family_photo_change') : t('family_photo_upload')}
                      </label>
                      {editPhoto && (
                        <button
                          type="button"
                          onClick={() => setEditPhoto(null)}
                          className="min-h-[44px] px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl font-medium"
                        >
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={cancelFamilyEdit}
                      className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 active:bg-stone-100"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={saveFamilyEdit}
                      className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                    >
                      {t('save')}
                    </button>
                  </div>
                </>
              ) : (
                /* Locked view */
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {familyPhoto ? (
                          <img src={familyPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-stone-400">
                            {(familyDisplayName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-stone-800 truncate">
                          {familyDisplayName || t('family_name_placeholder')}
                        </p>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={startFamilyEdit}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 flex items-center justify-center gap-2 active:bg-stone-100"
                      >
                        <Pencil className="w-4 h-4" />
                        {t('family_edit')}
                      </button>
                    )}
                  </div>
                  {!canEdit && (
                    <p className="text-sm text-stone-500">{t('family_connect_to_edit')}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selection color */}
          <div className="w-full pt-4">
            <h3 className="text-sm font-medium text-stone-700 mb-3">{t('settings_selection_color')}</h3>
            <p className="text-xs text-stone-500 mb-3">{t('settings_selection_color_subtitle')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444',
                '#06b6d4', '#84cc16', '#6366f1', '#14b8a6',
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectionColor(color)}
                  className={`w-10 h-10 rounded-full border-2 transition-all min-h-[44px] min-w-[44px] ${
                    selectionColor === color ? 'border-stone-900 ring-2 ring-offset-2 ring-stone-400' : 'border-stone-200 hover:border-stone-300'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={t('settings_selection_color')}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mx-auto pt-4">
            <button
              type="button"
              onClick={() => {
                setSharingModalMode('roles');
                setSharingModalOpen(true);
              }}
              className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px] w-full text-left cursor-pointer hover:bg-stone-100 hover:border-stone-200 transition-colors active:bg-stone-100"
            >
              <Shield className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_access_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_access_subtitle')}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setSharingModalMode('sharing');
                setSharingModalOpen(true);
              }}
              className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px] w-full text-left cursor-pointer hover:bg-stone-100 hover:border-stone-200 transition-colors active:bg-stone-100"
            >
              <Share2 className="w-8 h-8 text-emerald-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_sharing_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_sharing_subtitle')}</p>
            </button>

            <button
              type="button"
              onClick={() => setCalendarModalOpen(true)}
              className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px] w-full text-left cursor-pointer hover:bg-stone-100 hover:border-stone-200 transition-colors active:bg-stone-100"
            >
              <CalendarIcon className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_calendar_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_calendar_subtitle')}</p>
              <p className={`mt-2 text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isConnected ? t('auth_connected') : t('auth_not_connected')}
              </p>
            </button>

            <button
              type="button"
              onClick={handleDriveCardClick}
              className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px] w-full text-left cursor-pointer hover:bg-stone-100 hover:border-stone-200 transition-colors active:bg-stone-100"
            >
              <HardDrive className="w-8 h-8 text-amber-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_drive_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_drive_subtitle')}</p>
              <p className={`mt-2 text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isConnected ? t('auth_connected') : t('auth_not_connected')}
              </p>
            </button>
          </div>

          {/* Clear cache */}
          <div className="w-full pt-4 border-t border-stone-200">
            <button
              onClick={() => {
                cacheClear();
                showToast(t('cache_cleared'), 'success');
                window.location.reload();
              }}
              className="min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 active:bg-stone-100"
            >
              {t('clear_cache')}
            </button>
          </div>

          {/* Sync status (temporary) */}
          {isConnected && (
            <div className="w-full pt-4 border-t border-stone-200">
              <h3 className="text-xs font-medium text-stone-500 mb-2">{t('sync_status_title')}</h3>
              <div className="p-3 bg-stone-100 rounded-xl text-sm text-stone-600 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_people')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.people ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.people && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.people).toLocaleString()}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_appointments')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.appointments ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.appointments && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.appointments).toLocaleString()}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_index')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.index ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.index && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.index).toLocaleString()}</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drive Sync Status modal */}
      {driveSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-900">{t('drive_sync_status_title')}</h2>
              <button onClick={() => setDriveSyncModalOpen(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-stone-100 rounded-xl text-sm text-stone-600 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span>{t('family_profile_title')}</span>
                  <span className="flex items-center gap-1.5">
                    {driveDebug.syncStatus === 'Success' ? <span className="text-emerald-600">✓</span> : driveDebug.syncStatus ? <span className="text-amber-600">!</span> : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_people')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.people ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.people && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.people).toLocaleString()}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_appointments')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.appointments ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.appointments && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.appointments).toLocaleString()}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('sync_index')}</span>
                  <span className="flex items-center gap-1.5">
                    {dataSyncTimes.index ? <span className="text-emerald-600">✓</span> : '—'}
                    {dataSyncTimes.index && <span className="text-xs text-stone-500">{new Date(dataSyncTimes.index).toLocaleString()}</span>}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSyncNow}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                >
                  {t('sync_now')}
                </button>
                <button
                  onClick={() => {
                    cacheClear();
                    showToast(t('cache_cleared'), 'success');
                    setDriveSyncModalOpen(false);
                    window.location.reload();
                  }}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 active:bg-stone-100"
                >
                  {t('clear_cache')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar modal */}
      <CalendarModal open={calendarModalOpen} onClose={() => setCalendarModalOpen(false)} />

      {/* Family Sharing / Roles & Permissions modal */}
      <FamilySharingModal
        open={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        rolesMode={sharingModalMode === 'roles'}
      />

      {/* Coming soon modal */}
      {comingSoonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-900">{t('coming_soon')}</h2>
              <button onClick={() => setComingSoonModalOpen(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-stone-600">{t('coming_soon_desc')}</p>
            </div>
            <div className="p-4 border-t border-stone-100">
              <button
                onClick={() => setComingSoonModalOpen(false)}
                className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
