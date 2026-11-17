/* Key-based i18n (react-i18next) — the migration target replacing the legacy DOM
   walker (src/i18n/i18n.ts, the mock's verbatim machinery) screen by screen.

   Design (see MIGRATION.md "i18n strategy"):
   - Natural keys: the key IS the English string; catalogs in locales/<lng>.json are
     seeded from the mock's I18N dict by scripts/extract-i18n.mjs (plus hand-maintained
     scripts/i18n-additions.json for strings the mock never had). EN is byte-exact by
     construction — a missing key returns the key itself (fallbackLng 'en').
   - keySeparator/nsSeparator are DISABLED: keys are sentences containing '.'/':'.
   - A component is migrated when its strings are wrapped in t() (useT()) and its DOM
     is fenced from the legacy walker with data-i18n-live (i18nSkipped() honors it).
     The attribute travels with the content, so PF6 portals (dropdown menus, modals)
     are fenced too. Unmigrated surfaces keep translating through the legacy walker.
   - Language state stays in appState (single source: &lang= deep link > mta.lang >
     'en'); the Shell effect mirrors it into i18next.changeLanguage. documentElement
     .lang/dir and localStorage stay with the legacy applyLang() until the walker is
     retired. */
import i18nextBase from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useTranslation } from 'react-i18next';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import tr from './locales/tr.json';

export const i18next = i18nextBase.createInstance();

i18next
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      ar: { translation: ar }, de: { translation: de }, en: { translation: en },
      es: { translation: es }, fr: { translation: fr }, it: { translation: it },
      ja: { translation: ja }, tr: { translation: tr },
    },
    keySeparator: false,      // keys are English sentences ("1. Source", "Tokens (30d)")
    nsSeparator: false,
    returnEmptyString: false, // an empty catalog value falls back to the EN key
    interpolation: { escapeValue: false },   // React already escapes output
    react: { useSuspense: false },
  });

/** Translator for migrated components: `const t = useT(); t('Sign out')`. */
export function useT() {
  return useTranslation().t;
}
