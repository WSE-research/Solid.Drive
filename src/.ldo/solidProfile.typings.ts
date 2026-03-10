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
  inbox: {
    "@id": string;
  };
  storage?: LdSet<{
    "@id": string;
  }>;
}
