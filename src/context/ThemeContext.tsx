import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeId = 'default' | 'homeboard' | 'controlcenter';

interface ThemeContextType {
  activeTheme: ThemeId;
  setActiveTheme: (id: ThemeId) => void;
  isBoard: boolean;
  isControlCenter: boolean;
  hasCustomLayout: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  activeTheme: 'default',
  setActiveTheme: () => {},
  isBoard: false,
  isControlCenter: false,
  hasCustomLayout: false,
});

export const useTheme = () => useContext(ThemeContext);

const THEME_STORAGE_KEY = 'famplan-theme';

const themes: Record<ThemeId, { cssVars: Record<string, string>; style: string }> = {
  default: {
    style: 'cozy',
    cssVars: {
      '--background': '30 50% 98%',
      '--foreground': '220 25% 18%',
      '--card': '30 55% 99%',
      '--card-foreground': '220 25% 18%',
      '--primary': '168 55% 42%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '30 45% 92%',
      '--secondary-foreground': '220 25% 18%',
      '--muted': '30 28% 91%',
      '--muted-foreground': '220 10% 44%',
      '--accent': '25 85% 60%',
      '--accent-foreground': '0 0% 100%',
      '--border': '30 24% 84%',
      '--input': '30 24% 82%',
      '--ring': '168 55% 42%',
      '--radius': '0.75rem',
    },
  },
  homeboard: {
    style: 'homeboard',
    cssVars: {
      '--background': '40 60% 96%',
      '--foreground': '30 30% 18%',
      '--card': '45 55% 93%',
      '--card-foreground': '30 30% 18%',
      '--primary': '32 95% 44%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '40 50% 88%',
      '--secondary-foreground': '30 30% 18%',
      '--muted': '38 30% 86%',
      '--muted-foreground': '30 15% 40%',
      '--accent': '0 72% 51%',
      '--accent-foreground': '0 0% 100%',
      '--border': '35 30% 78%',
      '--input': '35 30% 75%',
      '--ring': '32 95% 44%',
      '--radius': '0.5rem',
    },
  },
  controlcenter: {
    style: 'controlcenter',
    cssVars: {
      '--background': '214 50% 97%',
      '--foreground': '222 40% 14%',
      '--card': '0 0% 100%',
      '--card-foreground': '222 40% 14%',
      '--primary': '217 91% 52%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '214 35% 93%',
      '--secondary-foreground': '222 40% 14%',
      '--muted': '214 25% 90%',
      '--muted-foreground': '215 16% 44%',
      '--accent': '263 70% 58%',
      '--accent-foreground': '0 0% 100%',
      '--border': '214 22% 86%',
      '--input': '214 22% 83%',
      '--ring': '217 91% 52%',
      '--radius': '1rem',
    },
  },
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTheme, setActiveThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'homeboard' || saved === 'controlcenter' || saved === 'default') return saved;
    return 'default';
  });

  const setActiveTheme = (id: ThemeId) => {
    setActiveThemeState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  useEffect(() => {
    const theme = themes[activeTheme];
    const root = document.documentElement;
    Object.entries(theme.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-ui-style', theme.style);
  }, [activeTheme]);

  const isBoard = activeTheme === 'homeboard';
  const isControlCenter = activeTheme === 'controlcenter';
  const hasCustomLayout = isBoard || isControlCenter;

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, isBoard, isControlCenter, hasCustomLayout }}>
      {children}
    </ThemeContext.Provider>
  );
};
