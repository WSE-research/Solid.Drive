import { describe, it, expect } from 'vitest';
import { formatExpiry } from '../TrashView-file/formatExpiry';

const now = new Date('2026-01-15T12:00:00.000Z');

describe('formatExpiry', () => {
  it('returns expiryPast when expiresAt is in the past', () => {
    expect(formatExpiry('2026-01-01T00:00:00.000Z', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiryPast',
      count: 0,
    });
  });

  it('returns expiryPast when expiresAt equals now', () => {
    expect(formatExpiry(now.toISOString(), now)).toEqual({
      key: 'oneDriveLayout.trashView.expiryPast',
      count: 0,
    });
  });

  it('returns expiresToday when less than a day remains', () => {
    expect(formatExpiry('2026-01-16T00:00:00.000Z', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiresToday',
      count: 0,
    });
  });

  it('returns expiresTomorrow when between one and two days remain', () => {
    expect(formatExpiry('2026-01-17T00:00:00.000Z', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiresTomorrow',
      count: 0,
    });
  });

  it('returns expiresIn with the day count for anything further out', () => {
    expect(formatExpiry('2026-01-25T12:00:00.000Z', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiresIn',
      count: 10,
    });
  });

  it('returns expiryPast instead of "NaN days" when expiresAt is unparseable', () => {
    expect(formatExpiry('not-a-date', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiryPast',
      count: 0,
    });
  });

  it('returns expiryPast instead of "NaN days" when expiresAt is empty', () => {
    expect(formatExpiry('', now)).toEqual({
      key: 'oneDriveLayout.trashView.expiryPast',
      count: 0,
    });
  });
});
