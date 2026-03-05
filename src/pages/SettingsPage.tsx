import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useFamily } from '../context/FamilyProvider';
import { Settings, Share2, Shield, HardDrive, Calendar as CalendarIcon } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const { isConnected, email, connect, disconnect } = useAuth();
  const { familyDisplayName, familyPhoto, setFamilyDisplayName, setFamilyPhoto } = useFamily();
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    if (!isConnected) setEmailInput('');
  }, [isConnected]);

  const handleConnect = () => {
    connect(emailInput.trim() || undefined);
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
          <div className="w-full pt-4">
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
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={t('auth_email_placeholder')}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white"
                    dir="ltr"
                  />
                  <button
                    onClick={handleConnect}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors font-medium text-stone-800"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>{t('auth_connect_google')}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Family name + photo */}
          <div className="w-full pt-4">
            <h3 className="text-sm font-medium text-stone-700 mb-3">{t('family_name_label')}</h3>
            <div className="w-full p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
              <input
                type="text"
                value={familyDisplayName}
                onChange={(e) => setFamilyDisplayName(e.target.value)}
                placeholder={t('family_name_placeholder')}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white"
              />
              <div>
                <label className="block text-xs text-stone-500 mb-1">{t('family_photo_label')}</label>
                <div className="flex items-center gap-3 w-full">
                  {familyPhoto && (
                    <img src={familyPhoto} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  )}
                  <label className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onload = () => setFamilyPhoto(r.result as string);
                          r.readAsDataURL(f);
                        }
                        e.target.value = '';
                      }}
                    />
                    {familyPhoto ? t('family_photo_change') : t('family_photo_upload')}
                  </label>
                  {familyPhoto && (
                    <button
                      type="button"
                      onClick={() => setFamilyPhoto(null)}
                      className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mx-auto pt-4">
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px]">
              <Shield className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_access_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_access_subtitle')}</p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px]">
              <Share2 className="w-8 h-8 text-emerald-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_sharing_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_sharing_subtitle')}</p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px]">
              <CalendarIcon className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_calendar_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_calendar_subtitle')}</p>
              <p className={`mt-2 text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isConnected ? t('auth_connected') : t('auth_not_connected')}
              </p>
            </div>
            
            <div className="flex flex-col items-center p-6 bg-stone-50 rounded-2xl border border-stone-100 min-h-[140px]">
              <HardDrive className="w-8 h-8 text-amber-600 mb-3" />
              <h3 className="font-medium text-stone-900">{t('settings_cards_drive_title')}</h3>
              <p className="text-sm text-stone-500 text-center mt-1">{t('settings_cards_drive_subtitle')}</p>
              <p className={`mt-2 text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isConnected ? t('auth_connected') : t('auth_not_connected')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
