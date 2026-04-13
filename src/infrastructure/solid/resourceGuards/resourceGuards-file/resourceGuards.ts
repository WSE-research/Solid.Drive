/**
 * Type guard functions for Solid resource shapes.
 *
 * @remarks
 * Runtime checks to narrow unknown resources to specific capability interfaces.
 *
 * @packageDocumentation
 */

import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";
import type {
  LoadableResource,
  ReadableResource,
  BinaryResource,
  DeletableResource,
  ReloadableResource,
} from "@/types";

export type {
  LoadableResource,
  ReadableResource,
  BinaryResource,
  DeletableResource,
  ReloadableResource,
};

/**
 * Checks if the resource exposes the full loadable resource shape.
 *
 * @param resource - The resource to check
 * @returns True if resource has `isLoading`, `isUnfetched`, and `isFetched` properties
 *
 * @public
 */
export function isLoadable(resource: unknown): resource is LoadableResource {
  return typeof resource === "object" && resource !== null && "isLoading" in resource && "isUnfetched" in resource && "isFetched" in resource;
}

/**
 * Checks if the resource exposes an `isReading` method.
 *
 * @param resource - The resource to check
 * @returns True if resource has `isReading` property
 *
 * @public
 */
export function isReadable(resource: unknown): resource is ReadableResource {
  return typeof resource === "object" && resource !== null && "isReading" in resource;
}

/**
 * Checks if the resource exposes binary capabilities.
 *
 * @param resource - The resource to check
 * @returns True if resource has `isBinary` and `getBlob` methods
 *
 * @public
 */
export function isBinary(resource: unknown): resource is BinaryResource {
  return typeof resource === "object" && resource !== null && "isBinary" in resource && "getBlob" in resource;
}

/**
 * Checks if the resource exposes a `delete` method.
 *
 * @param resource - The resource to check
 * @returns True if resource has `delete` method
 *
 * @public
 */
export function isDeletable(resource: unknown): resource is DeletableResource {
  return typeof resource === "object" && resource !== null && "delete" in resource;
}

/**
 * Checks if the resource exposes a `reload` method.
 *
 * @param resource - The resource to check
 * @returns True if resource has `reload` method
 *
 * @public
 */
export function isReloadable(resource: unknown): resource is ReloadableResource {
  return typeof resource === "object" && resource !== null && "reload" in resource;
}

/**
 * Checks if the resource is a Solid container.
 *
 * @param resource - The resource to check
 * @returns True if resource has a `children` function
 *
 * @public
 */
export function isSolidContainer(resource: unknown): resource is SolidContainer {
  return (
    typeof resource === "object" &&
    resource !== null &&
    "children" in resource &&
    typeof (resource as SolidContainer).children === "function"
  );
}

/**
 * Checks if the resource is a Solid leaf (non-container resource).
 *
 * @param resource - The resource to check
 * @returns True if resource has type `SolidLeaf`
 *
 * @public
 */
export function isSolidLeaf(resource: unknown): resource is SolidLeaf {
  return (
    !!resource &&
    typeof resource === "object" &&
    "type" in resource &&
    (resource as SolidLeaf).type === "SolidLeaf"
  );
}
