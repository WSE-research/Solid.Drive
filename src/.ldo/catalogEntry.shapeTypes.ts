import type { ShapeType } from "@ldo/ldo";
import { catalogEntrySchema } from "./catalogEntry.schema";
import { catalogEntryContext } from "./catalogEntry.context";
import type { CatalogEntrySh } from "./catalogEntry.typings";

/**
 * =============================================================================
 * LDO ShapeTypes catalogEntry
 * =============================================================================
 */

/**
 * CatalogEntrySh ShapeType
 */
export const CatalogEntryShShapeType: ShapeType<CatalogEntrySh> = {
  schema: catalogEntrySchema,
  shape: "https://example.com/CatalogEntrySh",
  context: catalogEntryContext,
};
