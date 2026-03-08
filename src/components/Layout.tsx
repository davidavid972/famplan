import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useFamily } from '../context/FamilyProvider';
import { useAuth } from '../context/AuthProvider';
import { useActivity } from '../context/ActivityContext';
import { useTheme } from '../context/ThemeContext';
import { OfflineBanner } from './OfflineBanner';
import { SyncErrorBanner } from './SyncErrorBanner';
import { ProfileModal } from './ProfileModal';
import { BoardSidebar } from './BoardSidebar';
import { Calendar, Users, List, Settings, Globe, LayoutDashboard, Gauge, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

const boardNavItems = (t: (k: string) => string) => [
  { icon: Home, label: t('index_home'), path: '/' },
  { icon: LayoutDashboard, label: 'לוח', path: '/calendar' },
  { icon: Calendar, label: t('calendar'), path: '/calendar' },
  { icon: List, label: t('appointments'), path: '/appointments' },
  { icon: Users, label: t('people'), path: '/people' },
  { icon: Settings, label: t('settings'), path: '/settings' },
];

const controlCenterNavItems = (t: (k: string) => string) => [
  { icon: Gauge, label: 'מרכז שליטה', path: '/' },
  { icon: List, label: t('appointments'), path: '/appointments' },
  { icon: Calendar, label: t('calendar'), path: '/calendar' },
  { icon: Users, label: t('people'), path: '/people' },
  { icon: Settings, label: t('settings'), path: '/settings' },
];

export const Layout: React.FC = () => {
  const { t, language, setLanguage, dir } = useI18n();
  const { familyDisplayName, familyPhoto, selectionColor } = useFamily();
  const { canEdit, isConnected, isOnline } = useAuth();
  const { hasNewActivity } = useActivity();
  const { isBoard, isControlCenter } = useTheme();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--selection-color', selectionColor || '#10b981');
  }, [selectionColor]);

  const titlePart = familyDisplayName.trim()
    ? `${t('app_name')} | ${familyDisplayName}`
    : t('app_name');

  const defaultNavItems = [
    { path: '/', icon: Home, label: t('index_home') },
    { path: '/calendar', icon: Calendar, label: t('calendar') },
    { path: '/appointments', icon: List, label: t('appointments') },
    { path: '/people', icon: Users, label: t('people') },
    { path: '/settings', icon: Settings, label: t('settings'), badge: hasNewActivity },
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  // Home Board layout
  if (isBoard) {
    const navItems = boardNavItems(t);
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <BoardSidebar />
        <div className="md:hidden fixed top-0 right-0 left-0 z-50 h-12 bg-card/90 backdrop-blur-lg border-b border-border px-4 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
          </div>
        </div>
        <OfflineBanner isOnline={isOnline} isConnected={isConnected} />
        <SyncErrorBanner />
        <div className="md:mr-56 pt-12 md:pt-0">
          <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
            <Outlet />
          </main>
          <footer className="py-4 pb-20 md:pb-4 text-center">
            <p className="text-xs text-muted-foreground">{t('footer_copyright')}</p>
          </footer>
        </div>
        <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
        <nav className="md:hidden fixed bottom-0 right-0 left-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border">
          <div className="flex justify-around py-2 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink key={item.path} to={item.path}
                  className={cn("flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[48px]", isActive ? "text-primary" : "text-muted-foreground")}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // Control Center layout
  if (isControlCenter) {
    const navItems = controlCenterNavItems(t);
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <div className="hidden md:flex fixed top-0 right-0 left-0 z-50 h-14 bg-card/80 backdrop-blur-lg border-b border-border px-6 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center">
              <Gauge className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
          </div>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink key={item.path} to={item.path}
                  className={cn("relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                  {isActive && (
                    <motion.div layoutId="cc-nav-indicator" className="absolute inset-0 bg-primary/10 rounded-xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />
                  )}
                  <item.icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
          <button type="button" onClick={() => setProfileModalOpen(true)} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center" aria-label={t('auth_profile')}>
            {familyPhoto ? <img src={familyPhoto} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="text-sm font-bold text-primary">{(familyDisplayName || '?').charAt(0).toUpperCase()}</span>}
          </button>
        </div>
        <div className="md:hidden fixed top-0 right-0 left-0 z-50 h-12 bg-card/90 backdrop-blur-lg border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
              <Gauge className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
          </div>
        </div>
        <OfflineBanner isOnline={isOnline} isConnected={isConnected} />
        <SyncErrorBanner />
        <div className="pt-14 md:pt-14">
          <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
            <Outlet />
          </main>
          <footer className="py-4 pb-20 md:pb-4 text-center">
            <p className="text-xs text-muted-foreground">{t('footer_copyright')}</p>
          </footer>
        </div>
        <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
        <nav className="md:hidden fixed bottom-0 right-0 left-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg">
          <div className="grid grid-cols-5 gap-1 p-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink key={item.path} to={item.path}
                  className={cn("flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all", isActive ? "bg-primary/10 text-primary scale-105" : "text-muted-foreground active:scale-95")}>
                  <item.icon className={cn("w-6 h-6", isActive && "w-7 h-7")} />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // Default layout - project-polish design
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden" dir={dir}>
      {/* Desktop navbar - project-polish style */}
      <nav className="hidden md:flex fixed top-0 right-0 left-0 z-50 h-16 bg-card/80 backdrop-blur-lg border-b border-border px-6 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
        </div>
        <div className="flex items-center gap-1">
          {defaultNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 bg-primary/10 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
                {'badge' in item && item.badge && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full z-10" aria-label="חדש" />}
              </NavLink>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm font-medium text-foreground"
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            {language === 'he' ? t('lang_en') : t('lang_he')}
          </button>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={t('auth_profile')}
          >
            {isConnected ? (familyPhoto ? <img src={familyPhoto} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="text-sm font-bold text-primary">{(familyDisplayName || '?').charAt(0).toUpperCase()}</span>) : <Settings className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </nav>

      <OfflineBanner isOnline={isOnline} isConnected={isConnected} />
      <SyncErrorBanner />

      {/* Mobile top bar - project-polish style */}
      <div className="md:hidden fixed top-0 right-0 left-0 z-50 h-12 bg-card/90 backdrop-blur-lg border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setProfileModalOpen(true)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center" aria-label={t('auth_profile')}>
            {isConnected ? (familyPhoto ? <img src={familyPhoto} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="text-xs font-bold text-primary">{(familyDisplayName || '?').charAt(0).toUpperCase()}</span>) : <Settings className="w-4 h-4 text-primary" />}
          </button>
          <button onClick={toggleLanguage} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-xs font-medium text-foreground">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            {language === 'he' ? t('lang_en') : t('lang_he')}
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 pt-16 md:pt-20 pb-24 md:pb-8">
        <Outlet />
      </main>

      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

      <footer className="py-4 pb-20 md:pb-4 text-center">
        <p className="text-xs text-muted-foreground">{t('footer_copyright')}</p>
      </footer>

      {/* Mobile bottom nav - project-polish style */}
      <nav className="md:hidden fixed bottom-0 right-0 left-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-2">
          {defaultNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const showBadge = 'badge' in item && item.badge;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-indicator"
                    className="absolute -top-0.5 w-8 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative">
                  <item.icon className="w-5 h-5" />
                  {showBadge && <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" aria-label="חדש" />}
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
