/**
 * Avatar component for displaying user profile images.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";

/**
 * Props for the Avatar component.
 */
type AvatarProps = {
  src?: string;
  alt?: string;
  initial?: string;
  size?: "sm" | "md";
  isLoading?: boolean;
};

/**
 * Displays a user avatar image or fallback initial.
 * Shows a spinner when loading.
 *
 * @public
 */
export const Avatar: FunctionComponent<AvatarProps> = ({
  src,
  alt = "",
  initial = "?",
  size = "md",
  isLoading = false,
}) => {
  const sizeClass = size === "sm" ? "avatar--sm" : "";

  if (src) {
    return <img src={src} alt={alt} className={`avatar ${sizeClass}`.trim()} />;
  }

  return (
    <div className={`avatar avatar--placeholder ${sizeClass}`.trim()}>
      {isLoading ? <div className="spinner" /> : initial}
    </div>
  );
};
