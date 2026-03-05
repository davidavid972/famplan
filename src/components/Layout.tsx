import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useFamily } from '../context/FamilyProvider';
import { useAuth } from '../context/AuthProvider';
import { useActivity } from '../context/ActivityContext';
import { OfflineBanner } from './OfflineBanner';
import { SyncErrorBanner } from './SyncErrorBanner';
import { ProfileModal } from './ProfileModal';
import { Calendar, Users, List, Settings, Globe } from 'lucide-react';
import { cn } from '../utils/cn';

export const Layout: React.FC = () => {
  const { t, language, setLanguage, dir } = useI18n();
  const { familyDisplayName, familyPhoto, selectionColor } = useFamily();
  const { canEdit, isConnected, isOnline } = useAuth();
  const { hasNewActivity } = useActivity();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--selection-color', selectionColor || '#10b981');
  }, [selectionColor]);

  const titlePart = familyDisplayName.trim()
    ? `${t('app_name')} | ${familyDisplayName}`
    : t('app_name');

  const navItems = [
    { path: '/calendar', icon: Calendar, label: t('calendar') },
    { path: '/appointments', icon: List, label: t('appointments') },
    { path: '/people', icon: Users, label: t('people') },
    { path: '/settings', icon: Settings, label: t('settings'), badge: hasNewActivity },
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 font-sans overflow-x-hidden" dir={dir}>
      {/* Top Navigation (Desktop) */}
      <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-stone-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex-shrink-0 rounded-full p-0.5 cursor-pointer hover:ring-2 hover:ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label={t('auth_profile')}
            >
              {isConnected ? (
                familyPhoto ? (
                  <img src={familyPhoto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600 text-sm">
                    {(familyDisplayName || '?').charAt(0).toUpperCase()}
                  </div>
                )
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-emerald-600" />
                </div>
              )}
            </button>
            <h1 className="text-2xl font-bold text-emerald-700 tracking-tight truncate">{titlePart}</h1>
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200",
                    isActive
                      ? "text-stone-900"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  )
                }
                style={({ isActive }) => (isActive ? { backgroundColor: `${selectionColor}20`, color: selectionColor } : {})}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full" aria-label="חדש" />
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors font-medium border border-stone-200"
        >
          <Globe className="w-5 h-5" />
          <span>{language === 'he' ? t('lang_en') : t('lang_he')}</span>
        </button>
      </header>

      <OfflineBanner isOnline={isOnline} isConnected={isConnected} />
      <SyncErrorBanner />

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between gap-2 px-4 py-4 bg-white border-b border-stone-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex-shrink-0 rounded-full p-0.5 cursor-pointer hover:ring-2 hover:ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 active:opacity-80"
            aria-label={t('auth_profile')}
          >
            {isConnected ? (
              familyPhoto ? (
                <img src={familyPhoto} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600 text-xs">
                  {(familyDisplayName || '?').charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <Settings className="w-4 h-4 text-emerald-600" />
              </div>
            )}
          </button>
          <h1 className="text-lg font-bold text-emerald-700 tracking-tight truncate">{titlePart}</h1>
        </div>
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-full text-stone-600 hover:bg-stone-100 transition-colors border border-stone-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Globe className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

      {/* Footer */}
      <footer className="py-4 pb-20 md:pb-4 text-center">
        <p className="text-xs text-stone-400">{t('footer_copyright')}</p>
      </footer>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const showBadge = 'badge' in item && item.badge;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                  isActive ? "" : "text-stone-500 hover:text-stone-900"
                )}
                style={isActive ? { color: selectionColor } : {}}
              >
                <span className="relative">
                  <item.icon className={cn("w-6 h-6", isActive && "opacity-80")} style={isActive ? { color: selectionColor } : {}} />
                  {showBadge && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" aria-label="חדש" />}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
