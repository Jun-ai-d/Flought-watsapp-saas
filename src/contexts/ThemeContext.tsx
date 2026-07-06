import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type DesignLanguage = 'modern' | 'minimal' | 'professional';
export type ColorMode = 'light' | 'dark' | 'system';
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple';

interface ThemeContextType {
  designLanguage: DesignLanguage;
  colorMode: ColorMode;
  accentColor: AccentColor;
  setDesignLanguage: (lang: DesignLanguage) => void;
  setColorMode: (mode: ColorMode) => void;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, tenant } = useAuth();
  const [designLanguage, setDesignLanguageState] = useState<DesignLanguage>('modern');
  const [colorMode, setColorModeState] = useState<ColorMode>('system');
  const [accentColor, setAccentColorState] = useState<AccentColor>('orange');
  const initialized = useRef(false);

  // Load initial from DB or local storage
  useEffect(() => {
    const loadPreferences = async () => {
      let prefs = null;

      if (session?.user?.id && tenant?.id) {
        try {
          const { data } = await supabase
            .from('tenant_users')
            .select('preferences')
            .eq('user_id', session.user.id)
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          if ((data as any)?.preferences) {
            prefs = (data as any).preferences;
          }
        } catch (e) {
          console.error("Failed to load preferences from DB", e);
        }
      }

      // Fallback to local storage
      if (!prefs) {
        prefs = {
          designLanguage: localStorage.getItem('app-design-language') || 'modern',
          colorMode: localStorage.getItem('app-color-mode') || 'system',
          accentColor: localStorage.getItem('app-accent-color') || 'orange',
        };
      }

      setDesignLanguageState(prefs.designLanguage as DesignLanguage);
      setColorModeState(prefs.colorMode as ColorMode);
      setAccentColorState(prefs.accentColor as AccentColor);
      initialized.current = true;
    };

    loadPreferences();
  }, [session?.user?.id, tenant?.id]);

  // Save to DB and Local Storage
  const savePreferences = async (newPrefs: any) => {
    localStorage.setItem('app-design-language', newPrefs.designLanguage);
    localStorage.setItem('app-color-mode', newPrefs.colorMode);
    localStorage.setItem('app-accent-color', newPrefs.accentColor);

    if (session?.user?.id && tenant?.id) {
      try {
        await (supabase.from('tenant_users') as any).update({
          preferences: newPrefs
        }).eq('user_id', session.user.id).eq('tenant_id', tenant.id);
      } catch (e) {
        console.error("Failed to save preferences to DB", e);
      }
    }
  };

  const setDesignLanguage = (lang: DesignLanguage) => {
    setDesignLanguageState(lang);
    if (initialized.current) savePreferences({ designLanguage: lang, colorMode, accentColor });
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    if (initialized.current) savePreferences({ designLanguage, colorMode: mode, accentColor });
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    if (initialized.current) savePreferences({ designLanguage, colorMode, accentColor: color });
  };

  // Apply design language
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-modern', 'theme-minimal', 'theme-professional');
    root.classList.add(`theme-${designLanguage}`);
  }, [designLanguage]);

  // Apply color mode
  useEffect(() => {
    const applyColorMode = (mode: 'light' | 'dark') => {
      const root = window.document.documentElement;
      root.classList.remove('light-mode', 'dark-mode');
      root.classList.add(`${mode}-mode`);
    };

    if (colorMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyColorMode(mediaQuery.matches ? 'dark' : 'light');

      const listener = (e: MediaQueryListEvent) => applyColorMode(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyColorMode(colorMode);
    }
  }, [colorMode]);

  // Apply accent color
  useEffect(() => {
    const root = window.document.documentElement;
    const colors = {
      orange: '#C1440E',
      blue: '#2563EB',
      green: '#16A34A',
      purple: '#9333EA'
    };
    root.style.setProperty('--color-accent', colors[accentColor]);
    
    const lightColors = {
      orange: '#d65a24',
      blue: '#3b82f6',
      green: '#22c55e',
      purple: '#a855f7'
    };
    root.style.setProperty('--color-accent-light', lightColors[accentColor]);
  }, [accentColor]);

  return (
    <ThemeContext.Provider value={{ designLanguage, colorMode, accentColor, setDesignLanguage, setColorMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
