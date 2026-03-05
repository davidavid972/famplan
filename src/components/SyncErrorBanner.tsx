/**
 * Banner shown when Drive read fails. Never overwrites data with empty.
 */

import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useData } from '../context/DataProvider';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function SyncErrorBanner() {
  const { t } = useI18n();
  const { syncError, setSyncError } = useData();

  if (!syncError) return null;

  const handleRetry = () => {
    setSyncError(null);
    window.dispatchEvent(new CustomEvent('famplan-drive-sync-request'));
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-medium text-amber-900">{t('sync_error_banner')}</p>
      </div>
      <button
        onClick={handleRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium text-sm transition-colors min-h-[44px]"
      >
        <RefreshCw className="w-4 h-4" />
        {t('sync_error_retry')}
      </button>
    </div>
  );
}
