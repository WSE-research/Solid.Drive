import type { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for catalogEntry
 * =============================================================================
 */

/**
 * CatalogEntrySh Type
 */
export interface CatalogEntrySh {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": string;
  }>;
  name?: string;
  description?: string;
  encodingFormat?: string;
  contentSize?: string;
  uploadDate: string;
  publisher: {
    "@id": string;
  };
  conformsTo?: {
    "@id": string;
  };
  dateModified?: string;
  isPartOf?: {
    "@id": string;
  };
  sharedWith?: LdSet<{
    "@id": string;
  }>;
}
