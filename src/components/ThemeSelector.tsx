import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useTheme, type ThemeId } from '../context/ThemeContext';
import { cn } from '../utils/cn';

const themeOptions: { id: ThemeId; name: string; nameEn: string; preview: { primary: string; accent: string; bg: string }; badge?: string }[] = [
  { id: 'default', name: 'ברירת מחדל', nameEn: 'Default', preview: { primary: '#3a9e8e', accent: '#e8873a', bg: '#fdf9f5' } },
  { id: 'homeboard', name: 'לוח בית חם', nameEn: 'Home Board', preview: { primary: '#d97706', accent: '#dc2626', bg: '#fef3c7' }, badge: '✨ Layout חדש' },
  { id: 'controlcenter', name: 'מרכז שליטה', nameEn: 'Control Center', preview: { primary: '#2563eb', accent: '#8b5cf6', bg: '#eff6ff' }, badge: '🎛️ Layout חדש' },
];

export const ThemeSelector: React.FC<{ language?: 'he' | 'en' }> = ({ language = 'he' }) => {
  const { activeTheme, setActiveTheme } = useTheme();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">🎨 ערכות עיצוב</h3>
      <div className="grid grid-cols-2 gap-3">
        {themeOptions.map((theme, i) => (
          <motion.button
            key={theme.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            onClick={() => setActiveTheme(theme.id)}
            className={cn(
              'relative p-3 rounded-xl border-2 transition-all text-right',
              activeTheme === theme.id ? 'border-primary shadow-md' : 'border-border hover:border-muted-foreground/30'
            )}
          >
            {activeTheme === theme.id && (
              <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className="rounded-lg overflow-hidden mb-2 border" style={{ backgroundColor: theme.preview.bg }}>
              <div className="h-3 flex items-center px-2 gap-1" style={{ backgroundColor: theme.preview.primary }}>
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
              </div>
              <div className="p-2 space-y-1.5">
                <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: theme.preview.primary, opacity: 0.3 }} />
                <div className="flex gap-1">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: theme.preview.primary, opacity: 0.15 }} />
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: theme.preview.accent, opacity: 0.15 }} />
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: theme.preview.primary, opacity: 0.1 }} />
                </div>
                <div className="h-1 w-1/2 rounded" style={{ backgroundColor: theme.preview.primary, opacity: 0.2 }} />
              </div>
            </div>
            <p className="text-xs font-medium text-foreground">{language === 'he' ? theme.name : theme.nameEn}</p>
            {theme.badge && <span className="text-[10px] text-primary">{theme.badge}</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
