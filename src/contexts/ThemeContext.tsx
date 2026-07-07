import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type DesignLanguage = 'modern' | 'minimal' | 'professional';
export type ColorMode = 'light' | 'dark' | 'system';
export type AccentColor = 'emerald' | 'sapphire' | 'amethyst' | 'amber';

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
  const [accentColor, setAccentColorState] = useState<AccentColor>('emerald');
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

  // Apply color mode and accent color together
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Resolve mode
    let isDark = false;
    if (colorMode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = colorMode === 'dark';
    }

    const applyTheme = (dark: boolean) => {
      // Set structural classes
      root.classList.remove('light-mode', 'dark-mode');
      root.classList.add(dark ? 'dark-mode' : 'light-mode');

      // Set accent colors based on mode
      const darkAccents = {
        emerald: { main: '#002E23', light: '#00392C' },
        sapphire: { main: '#60A5FA', light: '#93C5FD' },
        amethyst: { main: '#A78BFA', light: '#C4B5FD' },
        amber: { main: '#FBBF24', light: '#FCD34D' }
      };

      const lightAccents = {
        emerald: { main: '#002E23', light: '#00392C' },
        sapphire: { main: '#2563EB', light: '#3B82F6' },
        amethyst: { main: '#7C3AED', light: '#8B5CF6' },
        amber: { main: '#B45309', light: '#D97706' }
      };

      const palette = dark ? darkAccents : lightAccents;
      
      const safeAccent = palette[accentColor] || palette.emerald;
      root.style.setProperty('--color-accent', safeAccent.main);
      root.style.setProperty('--color-accent-light', safeAccent.light);
    };

    applyTheme(isDark);

    if (colorMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [colorMode, accentColor]);

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
