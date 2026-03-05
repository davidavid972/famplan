import { useEffect } from 'react';
import { useToast } from '../context/ToastProvider';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Listens for famplan-calendar-error and famplan-auth-token-missing; shows toasts.
 */
export function CalendarErrorListener() {
  const { showToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    const calendarErrorHandler = (e: Event) => {
      const ev = e as CustomEvent<{ status: number; reason: string; body: string; needsApiKey?: boolean }>;
      const reason = ev.detail?.needsApiKey ? t('cal_api_key_required') : (ev.detail?.reason ?? ev.detail?.body ?? 'Unknown error');
      showToast(`שגיאת יומן: ${reason}`, 'error');
    };
    const tokenMissingHandler = () => {
      showToast(t('cal_permission_error'), 'error');
    };
    window.addEventListener('famplan-calendar-error', calendarErrorHandler);
    window.addEventListener('famplan-auth-token-missing', tokenMissingHandler);
    return () => {
      window.removeEventListener('famplan-calendar-error', calendarErrorHandler);
      window.removeEventListener('famplan-auth-token-missing', tokenMissingHandler);
    };
  }, [showToast, t]);

  return null;
}
