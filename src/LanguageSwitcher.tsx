import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

export const LanguageSwitcher: FunctionComponent = () => {
  const [translate, i18n] = useTranslation();

  return (
    <select
      aria-label={translate("languageSwitcher.label")}
      value={i18n.resolvedLanguage}
      onChange={(event) => i18n.changeLanguage(event.target.value)}
    >
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
};
