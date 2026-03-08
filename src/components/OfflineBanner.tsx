import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { WifiOff, CloudOff } from 'lucide-react';

interface OfflineBannerProps {
  /** Internet connectivity (navigator.onLine only - never from API failures) */
  isOnline: boolean;
  /** Google account connected (token/session) */
  isConnected: boolean;
}

export function OfflineBanner({ isOnline, isConnected }: OfflineBannerProps) {
  const { t } = useI18n();
  const visible = !isOnline || !isConnected;
  if (!visible) return null;

  const isOffline = !isOnline;
  const message = isOffline ? t('offline_banner') : t('google_not_connected_banner');
  const Icon = isOffline ? WifiOff : CloudOff;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 text-foreground border-b border-accent/30 text-sm font-medium"
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
