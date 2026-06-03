import type { ChangeEvent, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';

interface CustomIssuerFieldProps {
  readonly headingId: string;
  readonly value: string;
  readonly hasValue: boolean;
  readonly hasError: boolean;
  readonly onChange: (value: string) => void;
}

const ERROR_ID = 'landing-custom-error';

const buildInputClassName = (hasError: boolean): string =>
  hasError
    ? 'landing__custom-input landing__custom-input--error'
    : 'landing__custom-input';

export const CustomIssuerField: FunctionComponent<CustomIssuerFieldProps> = ({
  headingId,
  value,
  hasValue,
  hasError,
  onChange,
}) => {
  const [translate] = useTranslation();
  const heading = translate('landing.customIssuer.heading');
  const hint = translate('landing.customIssuer.hint');
  const about = translate('landing.customIssuer.about');
  const placeholder = translate('landing.customIssuer.placeholder');
  const errorMessage = translate('landing.customIssuer.invalid');
  const acceptedNotice = translate('landing.customIssuer.selectedNotice');

  const inputClassName = buildInputClassName(hasError);
  const describedBy = hasError ? ERROR_ID : undefined;
  const showAcceptedNotice = hasValue && !hasError;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value);

  return (
    <section className="landing__custom-block" aria-labelledby={headingId}>
      <landing-card-header>
        <h2 id={headingId} className="landing__card-title">
          {heading}
        </h2>
        <p className="landing__card-lead">{hint}</p>
      </landing-card-header>
      <p className="landing__custom-about">{about}</p>
      <input
        type="text"
        className={inputClassName}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        autoComplete="url"
        spellCheck={false}
      />
      {hasError && (
        <p id={ERROR_ID} className="landing__field-error" role="alert">
          {errorMessage}
        </p>
      )}
      {showAcceptedNotice && (
        <p className="landing__field-hint">{acceptedNotice}</p>
      )}
    </section>
  );
};
