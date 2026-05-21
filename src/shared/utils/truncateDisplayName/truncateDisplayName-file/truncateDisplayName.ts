import { MAX_DISPLAY_NAME_LENGTH } from "@/config";

const ELLIPSIS = "…";

/**
 * Shortens a display name to {@link MAX_DISPLAY_NAME_LENGTH} characters,
 * appending an ellipsis when truncated so rows render at a consistent
 * width.
 *
 * @public
 */
export const truncateDisplayName = (name: string): string =>
  name.length <= MAX_DISPLAY_NAME_LENGTH
    ? name
    : `${name.slice(0, MAX_DISPLAY_NAME_LENGTH)}${ELLIPSIS}`;
