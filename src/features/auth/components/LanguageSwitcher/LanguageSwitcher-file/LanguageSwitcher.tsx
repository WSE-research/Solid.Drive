/**
 * Language selection dropdown component.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/config";

/**
 * Dropdown to switch the application language at runtime.
 * Uses i18next for language management.
 *
 * @public
 */
export const LanguageSwitcher: FunctionComponent = () => {
  const [translate, i18n] = useTranslation();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    i18n.changeLanguage(event.target.value);

  return (
    <select
      aria-label={translate("languageSwitcher.label")}
      value={i18n.resolvedLanguage}
      onChange={handleLanguageChange}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
};
