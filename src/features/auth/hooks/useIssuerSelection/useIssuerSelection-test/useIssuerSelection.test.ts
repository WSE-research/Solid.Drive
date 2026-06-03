import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CUSTOM_PROVIDER_VALUE, SOLID_PROVIDERS } from '@/config';
import { useIssuerSelection } from '../useIssuerSelection-file/useIssuerSelection';

const firstRealProvider = SOLID_PROVIDERS.find(
  (provider) => provider.value !== CUSTOM_PROVIDER_VALUE,
);

describe('useIssuerSelection — initial state', () => {
  it('excludes the "custom" sentinel from provider cards', () => {
    const { result } = renderHook(() => useIssuerSelection());
    const hasCustomSentinel = result.current.providerCards.some(
      (provider) => provider.value === CUSTOM_PROVIDER_VALUE,
    );
    expect(hasCustomSentinel).toBe(false);
  });

  it('preselects the first real provider', () => {
    if (!firstRealProvider) return;
    const { result } = renderHook(() => useIssuerSelection());
    expect(result.current.selectedProviderValue).toBe(firstRealProvider.value);
  });

  it('starts with an empty custom issuer field', () => {
    const { result } = renderHook(() => useIssuerSelection());
    expect(result.current.customIssuerValue).toBe('');
    expect(result.current.hasCustomIssuer).toBe(false);
  });

  it('reports the preselected provider as the active issuer', () => {
    if (!firstRealProvider) return;
    const { result } = renderHook(() => useIssuerSelection());
    expect(result.current.activeIssuerUrl).toBe(firstRealProvider.value);
  });
});

describe('useIssuerSelection — provider card selection', () => {
  it('switches the active issuer when another card is picked', () => {
    const otherProvider = SOLID_PROVIDERS.find(
      (provider) =>
        provider.value !== CUSTOM_PROVIDER_VALUE &&
        provider.value !== firstRealProvider?.value,
    );
    if (!otherProvider) return;

    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.selectProvider(otherProvider.value));

    expect(result.current.selectedProviderValue).toBe(otherProvider.value);
    expect(result.current.activeIssuerUrl).toBe(otherProvider.value);
  });

  it('clears any custom issuer when a provider card is picked', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('https://typed.example'));
    act(() => result.current.selectProvider(result.current.providerCards[0].value));

    expect(result.current.customIssuerValue).toBe('');
    expect(result.current.hasCustomIssuer).toBe(false);
  });
});

describe('useIssuerSelection — custom issuer input', () => {
  it('deselects the provider card while a custom issuer is typed', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('https://typed.example'));
    expect(result.current.selectedProviderValue).toBe('');
  });

  it('marks an invalid custom URL as an error and disables the active issuer', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('not a url'));
    expect(result.current.customIssuerError).toBe(true);
    expect(result.current.activeIssuerUrl).toBe('');
  });

  it('accepts a valid custom URL and exposes it as the active issuer', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('https://typed.example'));
    expect(result.current.customIssuerError).toBe(false);
    expect(result.current.activeIssuerUrl).toBe('https://typed.example');
  });

  it('trims surrounding whitespace from the active issuer URL', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('  https://typed.example  '));
    expect(result.current.activeIssuerUrl).toBe('https://typed.example');
  });

  it('reports no custom issuer once the field is cleared', () => {
    const { result } = renderHook(() => useIssuerSelection());
    act(() => result.current.setCustomIssuer('https://typed.example'));
    act(() => result.current.setCustomIssuer(''));
    expect(result.current.hasCustomIssuer).toBe(false);
    expect(result.current.customIssuerError).toBe(false);
  });
});
