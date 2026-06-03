import { APP_NAME } from '@/config';

export interface BrandParts {
  primary: string;
  accent: string | undefined;
}

export function splitBrand(name: string): BrandParts {
  const dot = name.indexOf('.');
  if (dot < 0) {
    return { primary: name.toUpperCase(), accent: undefined };
  }
  return {
    primary: name.slice(0, dot).toUpperCase(),
    accent: name.slice(dot + 1).toUpperCase(),
  };
}

const parts = splitBrand(APP_NAME);

export const BRAND_PRIMARY = parts.primary;
export const BRAND_ACCENT = parts.accent;
export const HAS_BRAND_ACCENT = Boolean(parts.accent);
