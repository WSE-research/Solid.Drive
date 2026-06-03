import { useEffect, useRef, useState, type FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SolidProvider } from '@/config';

interface ProviderPickerProps {
  readonly headingId: string;
  readonly providers: readonly SolidProvider[];
  readonly recommendedValue: string | undefined;
  readonly selectedValue: string;
  readonly onSelect: (value: string) => void;
}

interface ProviderInfoProps {
  readonly label: string;
  readonly url?: string;
  readonly recommendedLabel?: string;
}

const buildOptionClassName = (active: boolean): string =>
  active
    ? 'landing__providers-option landing__providers-option--active'
    : 'landing__providers-option';

const ProviderInfo: FunctionComponent<ProviderInfoProps> = ({
  label,
  url,
  recommendedLabel,
}) => (
  <landing-provider-info>
    <span className="landing__provider-label">{label}</span>
    {url && <span className="landing__provider-url">{url}</span>}
    {recommendedLabel && (
      <span className="landing__provider-tag">{recommendedLabel}</span>
    )}
  </landing-provider-info>
);

export const ProviderPicker: FunctionComponent<ProviderPickerProps> = ({
  headingId,
  providers,
  recommendedValue,
  selectedValue,
  onSelect,
}) => {
  const [translate] = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLElement>(null);

  const heading = translate('landing.providers.heading');
  const hint = translate('landing.providers.hint');
  const recommendedLabel = translate('landing.providers.recommended');
  const noneSelectedLabel = translate('landing.providers.noneSelected');
  const expandLabel = translate('landing.providers.expand');
  const collapseLabel = translate('landing.providers.collapse');

  const selectedProvider = providers.find(
    (provider) => provider.value === selectedValue,
  );
  const triggerLabel = selectedProvider?.label ?? noneSelectedLabel;
  const triggerUrl = selectedProvider?.value;
  const triggerAriaLabel = isOpen ? collapseLabel : expandLabel;
  const listboxId = `${headingId}-listbox`;
  const listboxState = isOpen ? 'open' : 'closed';

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent): void => {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const handleToggle = (): void => setIsOpen((prev) => !prev);
  const handleSelect = (value: string): void => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <section className="landing__providers-block" aria-labelledby={headingId}>
      <landing-card-header>
        <h2 id={headingId} className="landing__card-title">
          {heading}
        </h2>
        <p className="landing__card-lead">{hint}</p>
      </landing-card-header>
      <landing-providers-combobox ref={containerRef}>
        <button
          type="button"
          className="landing__providers-trigger"
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={triggerAriaLabel}
        >
          <ProviderInfo label={triggerLabel} url={triggerUrl} />
          <landing-providers-chevron
            data-expanded={isOpen || undefined}
            aria-hidden="true"
          />
        </button>
        <landing-providers-listbox-wrapper data-state={listboxState}>
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={headingId}
            aria-hidden={!isOpen}
            data-state={listboxState}
            className="landing__providers-listbox"
          >
            {providers.map((provider) => {
              const isActive = provider.value === selectedValue;
              const isRecommended = provider.value === recommendedValue;
              const optionClassName = buildOptionClassName(isActive);
              const handleClick = (): void => handleSelect(provider.value);

              return (
                <li key={provider.value} className="landing__providers-option-item">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    tabIndex={isOpen ? 0 : -1}
                    className={optionClassName}
                    onClick={handleClick}
                  >
                    <ProviderInfo
                      label={provider.label}
                      url={provider.value}
                      recommendedLabel={isRecommended ? recommendedLabel : undefined}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </landing-providers-listbox-wrapper>
      </landing-providers-combobox>
    </section>
  );
};
