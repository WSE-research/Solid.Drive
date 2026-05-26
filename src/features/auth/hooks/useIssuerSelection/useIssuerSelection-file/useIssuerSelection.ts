import { useCallback, useMemo, useState } from 'react';
import { CUSTOM_PROVIDER_VALUE, SOLID_PROVIDERS, type SolidProvider } from '@/config';
import { isValidIssuerUrl } from '@/features/auth/utils/isValidIssuerUrl';

export interface IssuerSelection {
  readonly providerCards: readonly SolidProvider[];
  readonly selectedProviderValue: string;
  readonly customIssuerValue: string;
  readonly hasCustomIssuer: boolean;
  readonly customIssuerError: boolean;
  readonly activeIssuerUrl: string;
  readonly activeProvider: SolidProvider | undefined;
  readonly selectProvider: (value: string) => void;
  readonly setCustomIssuer: (value: string) => void;
}

const filterSelectableProviders = (
  providers: readonly SolidProvider[],
): readonly SolidProvider[] =>
  providers.filter((provider) => provider.value !== CUSTOM_PROVIDER_VALUE);

const findProvider = (
  providers: readonly SolidProvider[],
  value: string,
): SolidProvider | undefined =>
  providers.find((provider) => provider.value === value);

export const useIssuerSelection = (): IssuerSelection => {
  const providerCards = useMemo(
    () => filterSelectableProviders(SOLID_PROVIDERS),
    [],
  );
  const defaultProviderValue = providerCards[0]?.value ?? '';

  const [selectedProviderValue, setSelectedProviderValue] =
    useState(defaultProviderValue);
  const [customIssuerValue, setCustomIssuerValue] = useState('');

  const trimmedCustomIssuer = customIssuerValue.trim();
  const hasCustomIssuer = trimmedCustomIssuer.length > 0;
  const isCustomIssuerValid =
    hasCustomIssuer && isValidIssuerUrl(trimmedCustomIssuer);
  const customIssuerError = hasCustomIssuer && !isCustomIssuerValid;

  const activeIssuerUrl = hasCustomIssuer
    ? (isCustomIssuerValid ? trimmedCustomIssuer : '')
    : selectedProviderValue;

  const activeProvider = findProvider(providerCards, selectedProviderValue);

  const selectProvider = useCallback((value: string) => {
    setSelectedProviderValue(value);
    setCustomIssuerValue('');
  }, []);

  const setCustomIssuer = useCallback((value: string) => {
    setCustomIssuerValue(value);
    if (value.trim().length > 0) {
      setSelectedProviderValue('');
    }
  }, []);

  return {
    providerCards,
    selectedProviderValue,
    customIssuerValue,
    hasCustomIssuer,
    customIssuerError,
    activeIssuerUrl,
    activeProvider,
    selectProvider,
    setCustomIssuer,
  };
};
