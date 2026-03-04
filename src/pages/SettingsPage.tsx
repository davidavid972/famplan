import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Settings, Share2, Shield, HardDrive, Calendar as CalendarIcon } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">{t('settings')}</h1>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
            <Settings className="w-10 h-10 text-stone-400" />
          </div>
          
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-semibold text-stone-900">
              {t('future_placeholder')}
            </h2>
            <p className="text-stone-500">
              {t('settings_placeholder_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-8">
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100">
              <Share2 className="w-8 h-8 text-emerald-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_family_sharing')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_family_sharing_desc')}</p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100">
              <Shield className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_roles')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_roles_desc')}</p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100">
              <HardDrive className="w-8 h-8 text-amber-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_drive_sync')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_drive_sync_desc')}</p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100">
              <CalendarIcon className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_calendar')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_calendar_desc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
