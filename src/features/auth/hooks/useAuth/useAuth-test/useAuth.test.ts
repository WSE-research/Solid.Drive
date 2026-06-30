import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(),
}));

import { useSolidAuth } from '@ldo/solid-react';
import { useAuth } from '../useAuth-file/useAuth';

const mockLogin = vi.fn();
const mockLogout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAuth — logged out', () => {
  beforeEach(() => {
    (useSolidAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { isActive: false, webId: undefined },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('returns isLoggedIn as false', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('returns webId as undefined', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.webId).toBeUndefined();
  });

  it('exposes login as a callable function from useSolidAuth', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.login).toBe('function');
  });

  it('exposes logout as a callable function from useSolidAuth', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logout).toBe('function');
  });

  it('exposes the raw session object reflecting logged-out state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.session).toEqual({ isActive: false, webId: undefined });
  });

  it('calls login with the issuer URL', async () => {
    const { result } = renderHook(() => useAuth());
    await result.current.login('https://solidcommunity.net', 'https://app.example/');
    expect(mockLogin).toHaveBeenCalledWith('https://solidcommunity.net', 'https://app.example/');
  });

  it('calls logout on the underlying session and completes once', async () => {
    const { result } = renderHook(() => useAuth());
    await result.current.logout();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

describe('useAuth — logged in', () => {
  beforeEach(() => {
    (useSolidAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { isActive: true, webId: 'https://user.solidcommunity.net/profile/card#me' },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('returns isLoggedIn as true', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('returns the correct webId', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.webId).toBe('https://user.solidcommunity.net/profile/card#me');
  });

  it('exposes the raw session object with webId', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.session).toEqual({
      isActive: true,
      webId: 'https://user.solidcommunity.net/profile/card#me',
    });
  });
});
