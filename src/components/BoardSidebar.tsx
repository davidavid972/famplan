import React from 'react';
import { Calendar, Users, List, Settings, LayoutDashboard } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { useFamily } from '../context/FamilyProvider';
import { useAuth } from '../context/AuthProvider';
import { cn } from '../utils/cn';

export const BoardSidebar: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const { familyDisplayName, familyPhoto } = useFamily();
  const { isConnected } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'לוח', path: '/calendar' },
    { icon: List, label: t('appointments'), path: '/appointments' },
    { icon: Users, label: t('people'), path: '/people' },
    { icon: Settings, label: t('settings'), path: '/settings' },
  ];

  return (
    <aside className="hidden md:flex fixed top-0 right-0 bottom-0 z-40 w-56 flex-col bg-card/95 backdrop-blur-lg border-l border-border">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('app_name')}</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <item.icon className="w-5 h-5 relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          {isConnected && familyPhoto ? (
            <img src={familyPhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{(familyDisplayName || '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground truncate">{familyDisplayName || t('app_name')}</p>
            <p className="text-xs text-muted-foreground">{isConnected ? '' : t('auth_not_connected')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
