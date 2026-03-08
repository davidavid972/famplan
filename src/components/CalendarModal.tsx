/**
 * Google Calendar modal: ensure FamPlan calendar, show duplicate warning.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import {
  driveEnsureFamPlanStructure,
  driveLoadFamily,
  driveWriteJson,
  type FamilyData,
} from '../lib/drive';
import { ensureFamPlanCalendarWithMeta, createTestNotificationEvent } from '../lib/calendar';

const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const FILE_ID_KEY = 'famplan_drive_family_file_id';

interface CalendarModalProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarModal({ open, onClose }: CalendarModalProps) {
  const { t } = useI18n();
  const { isConnected } = useAuth();
  const { showToast } = useToast();
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [multipleFound, setMultipleFound] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!open || !isConnected) return;
    let cancelled = false;
    setIsEnsuring(true);
    setCalendarId(null);
    setMultipleFound(false);

    async function ensure() {
      try {
        const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
        const { dataFolderId } = await driveEnsureFamPlanStructure(cachedRoot);
        if (cancelled) return;
        const { data, fileId } = await driveLoadFamily(dataFolderId);
        if (cancelled) return;
        const { calendarId: resolvedId, multipleFound: multi } = await ensureFamPlanCalendarWithMeta(data.calendarId ?? null);
        if (cancelled) return;
        setCalendarId(resolvedId);
        setMultipleFound(multi);

        const needsPersist = resolvedId !== (data.calendarId ?? null);
        if (needsPersist) {
          const updated: FamilyData = {
            ...data,
            calendarId: resolvedId,
          };
          await driveWriteJson(fileId, updated);
          localStorage.setItem('famplan_calendar_id', resolvedId);
          window.dispatchEvent(new CustomEvent('famplan-drive-sync-request'));
        }
      } catch (e) {
        console.warn('Calendar ensure failed:', e);
        const msg = e instanceof Error ? e.message : String(e);
        showToast(msg === 'CALENDAR_403' ? t('cal_permission_error') : msg, 'error');
      } finally {
        if (!cancelled) setIsEnsuring(false);
      }
    }

    ensure();
    return () => { cancelled = true; };
  }, [open, isConnected, showToast]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('settings_cards_calendar_title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {!isConnected ? (
            <p className="text-muted-foreground text-sm">{t('sharing_connect_required')}</p>
          ) : isEnsuring ? (
            <p className="text-muted-foreground text-sm">...</p>
          ) : (
            <>
              <p className="text-foreground">{t('cal_detected_created')} ✓</p>
              {multipleFound && calendarId && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <p className="text-sm text-accent-foreground">
                    {t('cal_multiple_warning').replace('<id>', calendarId)}
                  </p>
                </div>
              )}
              {calendarId && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsTesting(true);
                    try {
                      await createTestNotificationEvent(calendarId);
                      showToast(t('test_notification_sent'), 'success');
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : 'Failed', 'error');
                    } finally {
                      setIsTesting(false);
                    }
                  }}
                  disabled={isTesting}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted disabled:opacity-60"
                >
                  {isTesting ? '...' : t('test_notification')}
                </button>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-foreground bg-card border border-border hover:bg-muted"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
