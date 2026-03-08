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

const themes: Record<ThemeId, { cssVars: Record<string, string>; style: string }> = {
  default: {
    style: 'cozy',
    cssVars: {
      '--background': '30 50% 98%',
      '--foreground': '220 25% 18%',
      '--card': '30 55% 99%',
      '--card-foreground': '220 25% 18%',
      '--popover': '30 55% 99%',
      '--popover-foreground': '220 25% 18%',
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
      '--family-blue': '210 70% 55%',
      '--family-pink': '340 65% 60%',
      '--family-purple': '270 50% 58%',
      '--family-green': '150 50% 45%',
      '--family-yellow': '42 90% 60%',
    },
  },
  homeboard: {
    style: 'homeboard',
    cssVars: {
      '--background': '40 60% 96%',
      '--foreground': '30 30% 18%',
      '--card': '45 55% 93%',
      '--card-foreground': '30 30% 18%',
      '--popover': '45 55% 93%',
      '--popover-foreground': '30 30% 18%',
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
      '--family-blue': '210 65% 50%',
      '--family-pink': '340 70% 58%',
      '--family-purple': '270 55% 55%',
      '--family-green': '145 55% 42%',
      '--family-yellow': '42 92% 55%',
    },
  },
  controlcenter: {
    style: 'controlcenter',
    cssVars: {
      '--background': '214 50% 97%',
      '--foreground': '222 40% 14%',
      '--card': '0 0% 100%',
      '--card-foreground': '222 40% 14%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '222 40% 14%',
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
      '--family-blue': '217 91% 52%',
      '--family-pink': '334 78% 60%',
      '--family-purple': '263 70% 58%',
      '--family-green': '155 65% 42%',
      '--family-yellow': '42 92% 55%',
    },
  },
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const activeTheme: ThemeId = 'default';

  const setActiveTheme = () => {}; // No-op: only default theme is used

  useEffect(() => {
    const theme = themes.default;
    const root = document.documentElement;
    Object.entries(theme.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-ui-style', theme.style);
  }, []);

  const isBoard = activeTheme === 'homeboard';
  const isControlCenter = activeTheme === 'controlcenter';
  const hasCustomLayout = isBoard || isControlCenter;

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, isBoard, isControlCenter, hasCustomLayout }}>
      {children}
    </ThemeContext.Provider>
  );
};
