import type { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for post
 * =============================================================================
 */

/**
 * PostSh Type
 */
export interface PostSh {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<
    | {
        "@id": "DigitalDocument";
      }
    | {
        "@id": "CreativeWork";
      }
    | {
        "@id": "Thing";
      }
  >;
  name?: string;
  description?: string;
  encodingFormat?: string;
  contentSize?: string;
  uploadDate: string;
  dateModified?: string;
  isPartOf?: {
    "@id": string;
  };
  sharedWith?: LdSet<{
    "@id": string;
  }>;
  publisher: {
    "@id": string;
  };
}
