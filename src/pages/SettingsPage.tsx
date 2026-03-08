import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useUserRole } from '../context/UserRoleProvider';
import { useFamily } from '../context/FamilyProvider';
import { useActivity } from '../context/ActivityContext';
import { useToast } from '../context/ToastProvider';
import { cacheClear } from '../lib/cache';
import { Settings, Share2, Shield, HardDrive, Calendar as CalendarIcon, Pencil, X, Activity, Bell, Globe, ChevronLeft, RefreshCw } from 'lucide-react';
import { FamilySharingModal } from '../components/FamilySharingModal';
import { CalendarModal } from '../components/CalendarModal';
import { auditLogLoad, type AuditLogEntry } from '../lib/auditLog';

const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const ACTIVITY_LAST_VIEWED_KEY = 'famplan_activity_last_viewed';
const FILE_ID_KEY = 'famplan_drive_family_file_id';
const SYNC_STATUS_KEY = 'famplan_drive_sync_status';
const SYNC_PEOPLE_KEY = 'famplan_drive_sync_people';
const SYNC_APPOINTMENTS_KEY = 'famplan_drive_sync_appointments';
const SYNC_INDEX_KEY = 'famplan_drive_sync_index';

type SectionId = 'general' | 'notifications' | 'sharing' | 'permissions' | 'activity' | 'sync' | null;

const SECTIONS: { id: SectionId; icon: React.ElementType; labelKey: string; descKey: string }[] = [
  { id: 'general', icon: Settings, labelKey: 'settings_general', descKey: 'settings_general_desc' },
  { id: 'notifications', icon: Bell, labelKey: 'settings_notifications', descKey: 'settings_notifications_desc' },
  { id: 'sharing', icon: Share2, labelKey: 'settings_sharing', descKey: 'settings_sharing_desc' },
  { id: 'permissions', icon: Shield, labelKey: 'settings_permissions', descKey: 'settings_permissions_desc' },
  { id: 'activity', icon: Activity, labelKey: 'settings_activity', descKey: 'settings_activity_desc' },
  { id: 'sync', icon: Globe, labelKey: 'settings_sync', descKey: 'settings_sync_desc' },
];

export const SettingsPage: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const location = useLocation();
  const { isConnected, isOnline, canEdit, email, connect, disconnect, connectError, clearConnectError } = useAuth();
  const { userRole } = useUserRole();
  const { showToast } = useToast();
  const { familyDisplayName, familyPhoto, selectionColor, setFamilyDisplayName, setFamilyPhoto, setSelectionColor } = useFamily();
  const { syncCalendarToGoogle } = useData();
  const { hasNewActivity, clearBadge, refreshBadge } = useActivity();
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [driveDebug, setDriveDebug] = useState({ rootFolderId: '', dataFolderId: '', familyFileId: '', syncStatus: '' });
  const [dataSyncTimes, setDataSyncTimes] = useState({ people: '', appointments: '', index: '' });
  const [isFamilyEditMode, setIsFamilyEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [driveSyncModalOpen, setDriveSyncModalOpen] = useState(false);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [sharingModalMode, setSharingModalMode] = useState<'sharing' | 'roles'>('sharing');
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityEntries, setActivityEntries] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);
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
      setActiveSection('sync');
      document.getElementById('family-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  useEffect(() => {
    const state = (location.state as { openNotifications?: boolean } | null)?.openNotifications;
    if (state) {
      setCalendarModalOpen(true);
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.pathname, location.state]);

  useEffect(() => {
    if (isConnected && location.pathname === '/settings') refreshBadge();
  }, [isConnected, location.pathname, refreshBadge]);

  const openActivityModal = () => {
    setActivityModalOpen(true);
    setActivityLoading(true);
    const dataFolderId = localStorage.getItem(DATA_FOLDER_KEY);
    if (!dataFolderId) {
      setActivityLoading(false);
      return;
    }
    auditLogLoad(dataFolderId)
      .then(({ data }) => {
        const last50 = (data.entries ?? []).slice(-50).reverse();
        setActivityEntries(last50);
        const latest = last50[0]?.ts;
        if (latest) localStorage.setItem(ACTIVITY_LAST_VIEWED_KEY, latest);
        clearBadge();
      })
      .catch(() => setActivityEntries([]))
      .finally(() => setActivityLoading(false));
  };

  const formatAction = (action: string): string => {
    const map: Record<string, string> = {
      'people.add': t('activity_people_add'),
      'people.update': t('activity_people_update'),
      'people.delete': t('activity_people_delete'),
      'appointments.add': t('activity_appointments_add'),
      'appointments.update': t('activity_appointments_update'),
      'appointments.delete': t('activity_appointments_delete'),
      'attachments.add': t('activity_attachments_add'),
      'attachments.delete': t('activity_attachments_delete'),
    };
    return map[action] ?? action;
  };

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
      setActiveSection('sync');
      authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      authSectionRef.current?.focus();
    }
  };

  const handleSyncNow = () => {
    window.dispatchEvent(new CustomEvent('famplan-drive-sync-request'));
    refreshDriveDebug();
  };

  const handleSectionClick = (id: SectionId) => {
    if (id === 'sharing') {
      setSharingModalMode('sharing');
      setSharingModalOpen(true);
      return;
    }
    if (id === 'permissions') {
      setSharingModalMode('roles');
      setSharingModalOpen(true);
      return;
    }
    if (id === 'activity') {
      openActivityModal();
      return;
    }
    if (id === 'notifications') {
      setCalendarModalOpen(true);
      return;
    }
    setActiveSection(id);
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">{t('lang_picker_title')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('he')}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium transition-colors ${
                    language === 'he' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted text-foreground'
                  }`}
                >
                  עברית
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium transition-colors ${
                    language === 'en' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted text-foreground'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">{t('settings_selection_color')}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t('settings_selection_color_subtitle')}</p>
              <div className="flex flex-wrap gap-2">
                {['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectionColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all min-h-[44px] min-w-[44px] ${
                      selectionColor === color ? 'border-foreground ring-2 ring-offset-2 ring-muted-foreground' : 'border-border hover:border-muted-foreground'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={t('settings_selection_color')}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 'sync':
        return (
          <div className="space-y-6">
            {/* Google Account - design from reference */}
            <div ref={authSectionRef} tabIndex={-1} className="border-b border-border pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-card border border-border">
                    <svg className="w-7 h-7" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('sync_google_account')}</p>
                    <p className="text-xs text-muted-foreground">{isConnected ? email : t('sync_no_active_connection')}</p>
                  </div>
                </div>
                {isConnected ? (
                  <button
                    onClick={disconnect}
                    className="min-h-[44px] px-6 py-3 text-sm text-destructive hover:bg-destructive/10 rounded-xl font-medium transition-colors border border-destructive/30"
                  >
                    {t('auth_disconnect')}
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="theme-primary-btn min-h-[48px] min-w-[120px] flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>{isConnecting ? t('auth_connecting') : t('sync_connect_btn')}</span>
                  </button>
                )}
              </div>
              {connectError && <p className="text-sm text-destructive mt-2">{t('auth_connect_error')}</p>}
            </div>

            {/* Sync options */}
            <div className="border-b border-border pb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('sync_options_title')}</h3>
              <div className="space-y-2">
                {isConnected && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsCalendarSyncing(true);
                      try {
                        const { synced, created } = await syncCalendarToGoogle();
                        showToast(t('sync_calendar_done').replace('{synced}', String(synced)).replace('{created}', String(created)), 'success');
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : 'Sync failed', 'error');
                      } finally {
                        setIsCalendarSyncing(false);
                      }
                    }}
                    disabled={!canEdit || isCalendarSyncing}
                    className="flex items-center gap-4 w-full p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-right disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarIcon className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{t('sync_calendar_btn')}</p>
                      <p className="text-xs text-muted-foreground">{t('sync_calendar_desc')}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                      <RefreshCw className={`w-5 h-5 ${isCalendarSyncing ? 'animate-spin' : ''}`} />
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCalendarModalOpen(true)}
                  className="flex items-center gap-4 w-full p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-right"
                >
                  <CalendarIcon className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{t('settings_cards_calendar_title')}</p>
                    <p className="text-xs text-muted-foreground">{t('sync_calendar_desc')}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isConnected ? 'bg-primary/20 text-primary' : 'bg-muted border border-border'}`}>
                    {isConnected ? <span className="text-lg">✓</span> : <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/50" />}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleDriveCardClick}
                  className="flex items-center gap-4 w-full p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-right"
                >
                  <HardDrive className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{t('settings_cards_drive_title')}</p>
                    <p className="text-xs text-muted-foreground">{t('sync_drive_desc')}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isConnected ? 'bg-primary/20 text-primary' : 'bg-muted border border-border'}`}>
                    {isConnected ? <span className="text-lg">✓</span> : <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/50" />}
                  </div>
                </button>
              </div>
            </div>

            <div id="family-profile" className="scroll-mt-24">
              <h3 className="text-sm font-medium text-foreground mb-3">{t('family_profile_title')}</h3>
              <div className="p-4 sm:p-5 bg-secondary rounded-2xl border border-border space-y-4">
                {isFamilyEditMode && canEdit ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('family_name_placeholder')}
                      className="w-full px-4 py-3 min-h-[44px] rounded-xl border border-border text-sm bg-card text-foreground"
                    />
                    <div>
                      <label className="block text-xs text-muted-foreground mb-2">{t('family_photo_label')}</label>
                      <div className="flex items-center gap-3 w-full">
                        {editPhoto && <img src={editPhoto} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />}
                        <label className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted cursor-pointer font-medium">
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
                          <button type="button" onClick={() => setEditPhoto(null)} className="min-h-[44px] px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-xl font-medium">
                            {t('delete')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={cancelFamilyEdit} className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted active:bg-secondary">
                        {t('cancel')}
                      </button>
                      <button onClick={saveFamilyEdit} className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80">
                        {t('save')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {familyPhoto ? <img src={familyPhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-muted-foreground">{(familyDisplayName || '?').charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-foreground truncate">{familyDisplayName || t('family_name_placeholder')}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <button onClick={startFamilyEdit} className="w-full sm:w-auto min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted flex items-center justify-center gap-2 active:bg-secondary">
                          <Pencil className="w-4 h-4" />
                          {t('family_edit')}
                        </button>
                      )}
                    </div>
                    {!canEdit && <p className="text-sm text-muted-foreground">{t('family_connect_to_edit')}</p>}
                  </>
                )}
              </div>
            </div>

            {isConnected && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('sync_status_title')}</h3>
                <div className="p-3 bg-secondary rounded-xl text-sm text-muted-foreground space-y-2">
                  {[
                    { key: 'sync_people', val: dataSyncTimes.people },
                    { key: 'sync_appointments', val: dataSyncTimes.appointments },
                    { key: 'sync_index', val: dataSyncTimes.index },
                  ].map(({ key, val }) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span>{t(key)}</span>
                      <span className="flex items-center gap-1.5">
                        {val ? <span className="text-primary">✓</span> : '—'}
                        {val && <span className="text-xs text-muted-foreground">{new Date(val).toLocaleString()}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <button
                onClick={() => { cacheClear(); showToast(t('cache_cleared'), 'success'); window.location.reload(); }}
                className="min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted active:bg-secondary"
              >
                {t('clear_cache')}
              </button>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Debug</h3>
              <div className="p-3 bg-secondary rounded-xl text-sm text-foreground space-y-1 font-mono">
                <div>role: {userRole ?? 'null'}</div>
                <div>online: {String(isOnline)}</div>
                <div>connected: {String(isConnected)}</div>
                <div>canEdit: {String(canEdit)}</div>
                <div>last Drive write: {[dataSyncTimes.people, dataSyncTimes.appointments, dataSyncTimes.index].filter(Boolean).sort().pop() || '—'}</div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const sectionTitle: Record<string, string> = {
    general: t('settings_general'),
    sync: t('settings_sync_title'),
  };

  return (
    <div className="space-y-6 w-full">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('settings_title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t('settings_manage_prefs')}</p>
      </motion.div>

      {activeSection && renderSectionContent() ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-sm text-primary font-medium hover:underline min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('settings_back')}
          </button>
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{sectionTitle[activeSection] || t(activeSection === 'general' ? 'settings_general' : 'settings_title')}</h2>
          {renderSectionContent()}
        </motion.div>
      ) : (
        <div className="space-y-2">
          {SECTIONS.map(({ id, icon: Icon, labelKey, descKey }, i) => (
            <motion.button
              key={id}
              type="button"
              onClick={() => handleSectionClick(id)}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i }}
              className="flex items-center gap-4 p-4 w-full text-right theme-surface hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{t(labelKey)}</p>
                {t(descKey) && <p className="text-xs text-muted-foreground">{t(descKey)}</p>}
              </div>
              {id === 'activity' && hasNewActivity && (
                <span className="w-3 h-3 bg-accent rounded-full flex-shrink-0" aria-label="חדש" />
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Drive Sync Status modal */}
      {driveSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{t('drive_sync_status_title')}</h2>
              <button onClick={() => setDriveSyncModalOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-secondary rounded-xl text-sm text-muted-foreground space-y-2">
                {[
                  { key: 'family_profile_title', val: driveDebug.syncStatus },
                  { key: 'sync_people', val: dataSyncTimes.people },
                  { key: 'sync_appointments', val: dataSyncTimes.appointments },
                  { key: 'sync_index', val: dataSyncTimes.index },
                ].map(({ key, val }) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span>{t(key)}</span>
                    <span className="flex items-center gap-1.5">
                      {key === 'family_profile_title' ? (val === 'Success' ? <span className="text-primary">✓</span> : val ? <span className="text-accent">!</span> : '—') : val ? <span className="text-primary">✓</span> : '—'}
                      {val && key !== 'family_profile_title' && <span className="text-xs text-muted-foreground">{new Date(val).toLocaleString()}</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={handleSyncNow} className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80">
                  {t('sync_now')}
                </button>
                <button
                  onClick={() => { cacheClear(); showToast(t('cache_cleared'), 'success'); setDriveSyncModalOpen(false); window.location.reload(); }}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted active:bg-secondary"
                >
                  {t('clear_cache')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CalendarModal open={calendarModalOpen} onClose={() => setCalendarModalOpen(false)} />

      {activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{t('activity_title')}</h2>
              <button onClick={() => setActivityModalOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {activityLoading ? (
                <p className="text-muted-foreground text-sm">טוען...</p>
              ) : activityEntries.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('activity_empty')}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">{t('activity_showing_up_to_50')}</p>
                  <ul className="space-y-2">
                  {activityEntries.map((e, i) => (
                    <li key={i} className="text-sm p-3 bg-muted rounded-xl">
                      <span className="font-medium text-foreground">{formatAction(e.action)}</span>
                      {e.summary && <span className="text-muted-foreground"> — {e.summary}</span>}
                      <div className="text-xs text-muted-foreground mt-1">{e.userEmail} · {new Date(e.ts).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <FamilySharingModal open={sharingModalOpen} onClose={() => setSharingModalOpen(false)} rolesMode={sharingModalMode === 'roles'} />

    </div>
  );
};
