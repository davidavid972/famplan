import React, { Component, ErrorInfo, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleClearCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const savedLang = localStorage.getItem('famplan_lang') as Language;
      const lang = (savedLang === 'he' || savedLang === 'en') ? savedLang : 'he';
      const t = (key: keyof typeof translations.en) => translations[lang][key] || key;
      const dir = lang === 'he' ? 'rtl' : 'ltr';

      return (
        <div dir={dir} className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2">{t('error_boundary_title')}</h1>
            <p className="text-stone-600 mb-8">{t('error_boundary_desc')}</p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRefresh}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
              >
                {t('refresh_page')}
              </button>
              <button
                onClick={this.handleClearCache}
                className="w-full py-3 px-4 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-xl border border-stone-200 transition-colors"
              >
                {t('clear_cache')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
