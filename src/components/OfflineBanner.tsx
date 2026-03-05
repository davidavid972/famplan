import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-900 border-b border-amber-200 text-sm font-medium"
      role="alert"
    >
      <WifiOff className="w-5 h-5 flex-shrink-0" />
      <span>{t('offline_banner')}</span>
    </div>
  );
}
