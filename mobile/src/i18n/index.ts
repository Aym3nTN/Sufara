import { Platform, I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

export type SupportedLanguage = 'en' | 'ar' | 'fr';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'ar', 'fr'] as const;

const LANGUAGE_STORAGE_KEY = 'sufara.language';

const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar']);

export function isRtlLanguage(lng: string): boolean {
  return RTL_LANGUAGES.has(lng.slice(0, 2) as SupportedLanguage);
}

// SecureStore has no web build; localStorage is the web equivalent, kept in
// sync with the tokenStore pattern in api/client.ts.
async function readStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    let stored: string | null;
    if (Platform.OS === 'web') {
      stored = typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } else {
      stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    }
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // A failure to read a preference is never fatal — falls back to detection.
  }
  return null;
}

async function writeStoredLanguage(lng: SupportedLanguage): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } else {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lng);
    }
  } catch {
    // If the preference can't be saved the app still runs; it just won't
    // remember the choice next launch.
  }
}

function detectDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  for (const locale of locales) {
    const tag = (locale.languageCode ?? '').toLowerCase();
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(tag)) {
      return tag as SupportedLanguage;
    }
  }
  return 'en';
}

let initialized = false;

export async function initI18n(): Promise<SupportedLanguage> {
  if (initialized) return (i18n.language as SupportedLanguage) ?? 'en';

  const stored = await readStoredLanguage();
  const language = stored ?? detectDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      fr: { translation: fr },
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    compatibilityJSON: 'v4',
  });

  applyDirection(language);
  initialized = true;
  return language;
}

// Toggling I18nManager takes effect only after the JS bundle reloads. On
// native we cannot restart programmatically without a dev-only helper, so the
// UI prompts the user; on web the CSS `dir` attribute changes immediately.
function applyDirection(lng: string): void {
  const shouldBeRtl = isRtlLanguage(lng);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', shouldBeRtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lng);
    }
    return;
  }
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
  }
}

export async function setLanguage(lng: SupportedLanguage): Promise<{ needsRestart: boolean }> {
  const wasRtl = isRtlLanguage(i18n.language ?? 'en');
  const willBeRtl = isRtlLanguage(lng);
  await i18n.changeLanguage(lng);
  await writeStoredLanguage(lng);
  applyDirection(lng);
  return { needsRestart: Platform.OS !== 'web' && wasRtl !== willBeRtl };
}

export default i18n;
