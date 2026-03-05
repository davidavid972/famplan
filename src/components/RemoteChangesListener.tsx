/**
 * Listens for famplan-remote-changes and shows toast.
 */

import { useEffect } from 'react';
import { useToast } from '../context/ToastProvider';
import { useI18n } from '../i18n/I18nProvider';

export function RemoteChangesListener() {
  const { showToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    const handler = () => showToast(t('remote_changes_toast'), 'info');
    window.addEventListener('famplan-remote-changes', handler);
    return () => window.removeEventListener('famplan-remote-changes', handler);
  }, [showToast, t]);

  return null;
}
