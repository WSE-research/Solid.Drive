// Types for the jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...) under Vitest 5.
//
// Vitest 5 made its assertion types generic over <R, T> and no longer derives them from
// Jest's global `jest.Matchers`. @testing-library/jest-dom 7.0.1 only augments those older
// shapes, so its matchers still work at runtime (src/test-setup.ts registers them) but
// vanish from the types and `tsc -b` fails. Vitest's `Matchers` interface is its documented
// extension point for custom matchers; remove this file once jest-dom augments it itself.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  // The type parameters must match Vitest's own declaration of `Matchers`.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extends TestingLibraryMatchers<any, R> {}
}
