/**
 * i18n configuration and initialization.
 *
 * @remarks
 * Configures i18next with language detection and React integration.
 *
 * @packageDocumentation
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../../locales/en.json";
import de from "../../locales/de.json";
import { SUPPORTED_LANGUAGE_CODES, FALLBACK_LANGUAGE, LANGUAGE_DETECTION_ORDER, LANGUAGE_CACHE_LOCATIONS } from "@/config";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    detection: {
      order: [...LANGUAGE_DETECTION_ORDER],
      caches: [...LANGUAGE_CACHE_LOCATIONS],
    },
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Configured i18next instance.
 *
 * @public
 */
export default i18n;
