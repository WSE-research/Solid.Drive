/**
 * @packageDocumentation
 * Provides date formatting for the Recycle Bin's expiry column,
 * keeping expiry calculations out of {@link TrashTable}.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Translation key and interpolation count for an expiry label.
 *
 * @remarks
 * `count` is used by the `expiresIn` translation for pluralization.
 *
 * @public
 */
export interface ExpiryLabel {
  key: string;
  count: number;
}

/**
 * Formats the remaining retention time as expired, today, tomorrow, or a number of days.
 *
 * @remarks
 * An expired item may remain visible briefly until {@link useTrashEntries}
 * performs its next lazy purge.
 *
 * @param expiresAt - Expiry timestamp of the trashed item.
 * @param now - Current time used to calculate the remaining retention period.
 *
 * @returns The translation key and interpolation count for the expiry label.
 *
 * @public
 */
export function formatExpiry(expiresAt: string, now: Date): ExpiryLabel {
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return { key: 'oneDriveLayout.trashView.expiryPast', count: 0 };

  const diffDays = Math.ceil(diffMs / MS_PER_DAY);
  if (diffDays <= 1) return { key: 'oneDriveLayout.trashView.expiresToday', count: 0 };
  if (diffDays === 2) return { key: 'oneDriveLayout.trashView.expiresTomorrow', count: 0 };
  return { key: 'oneDriveLayout.trashView.expiresIn', count: diffDays };
}
