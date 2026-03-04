import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';

export const LoginScreen: React.FC = () => {
  const { t, dir } = useI18n();
  const { connect } = useAuth();
  const [email, setEmail] = useState('');

  const handleContinueWithGoogle = () => {
    connect(email.trim() || undefined);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50" dir={dir}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-emerald-700 tracking-tight mb-2">{t('app_name')}</h1>
          <p className="text-stone-500 text-sm">{t('auth_welcome')}</p>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 space-y-6">
          <button
            onClick={handleContinueWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors font-medium text-stone-800"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{t('auth_continue_google')}</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-stone-400">{t('auth_or_email')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth_email_label')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth_email_placeholder')}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-stone-50 focus:bg-white"
              dir="ltr"
            />
          </div>

          <p className="text-xs text-stone-400 text-center">{t('auth_placeholder_note')}</p>
        </div>
      </div>
    </div>
  );
};
