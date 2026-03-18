import type { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for solidProfile
 * =============================================================================
 */

/**
 * SolidProfile Type
 */
export interface SolidProfile {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<
    | {
        "@id": "Person";
      }
    | {
        "@id": "Person2";
      }
  >;
  fn?: string;
  name?: string;
  img?: {
    "@id": string;
  };
  knows?: LdSet<{
    "@id": string;
  }>;
  inbox: {
    "@id": string;
  };
  storage?: LdSet<{
    "@id": string;
  }>;
  publicTypeIndex?: {
    "@id": string;
  };
  privateTypeIndex?: {
    "@id": string;
  };
  catalog?: {
    "@id": string;
  };
}
