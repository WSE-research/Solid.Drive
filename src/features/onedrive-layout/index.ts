/**
 * Public API surface for the OneDrive-inspired layout feature.
 *
 * Anything that needs to be consumed from outside this feature folder
 * (e.g. by `app/` or by `auth/Header`) MUST be re-exported here. Direct
 * imports into the feature's internal sub-paths from outside the feature
 * are considered a private-API leak and should be replaced with imports
 * from this barrel.
 *
 * @packageDocumentation
 */

export { OneDriveLayout } from './components/OneDriveLayout';
export { LayoutToggle } from './components/LayoutToggle';
export {
  useLayoutPreference,
  isLayout,
  type Layout,
} from './hooks/useLayoutPreference';
