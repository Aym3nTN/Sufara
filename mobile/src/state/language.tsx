import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n, { setLanguage, type SupportedLanguage, isRtlLanguage } from '../i18n';

interface LanguageValue {
  language: SupportedLanguage;
  isRtl: boolean;
  change: (next: SupportedLanguage) => Promise<{ needsRestart: boolean }>;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLng] = useState<SupportedLanguage>(() => (i18n.language as SupportedLanguage) ?? 'en');

  useEffect(() => {
    const handler = (lng: string) => {
      if (lng === 'en' || lng === 'ar' || lng === 'fr') setLng(lng);
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const change = useCallback(async (next: SupportedLanguage) => {
    const result = await setLanguage(next);
    setLng(next);
    return result;
  }, []);

  const value = useMemo<LanguageValue>(
    () => ({ language, isRtl: isRtlLanguage(language), change }),
    [language, change],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
