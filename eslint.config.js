import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // ── Layer: config/ and types/ ─────────────────────────────────────────────
  // No imports from any project layer — these are pure leaf modules.
  {
    files: ['src/config/**/*.{ts,tsx}', 'src/types/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/app/*', '@/features/*', '@/infrastructure/*', '@/shared/*'], message: 'config/ and types/ must not import from other project layers.' },
        ],
      }],
    },
  },

  // ── Layer: shared/ ────────────────────────────────────────────────────────
  // May only import from types/ and config/.
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/app/*', '@/features/*', '@/infrastructure/*'], message: 'shared/ must not import from app/, features/, or infrastructure/.' },
        ],
      }],
    },
  },

  // ── Exception: useContactRejections ───────────────────────────────────────
  // This hook lives in shared/ because both file-explorer and profile consume
  // it, but it wraps the inbox infrastructure to read rejection notifications.
  // It can't move into infrastructure/ (that layer is React-free), so it is
  // allowed to reach into infrastructure/inbox while staying barred from app/
  // and features/.
  {
    files: ['src/shared/hooks/useContactRejections/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/app/*', '@/features/*'], message: 'shared/ must not import from app/ or features/.' },
        ],
      }],
    },
  },

  // ── Layer: infrastructure/ ────────────────────────────────────────────────
  // May import from shared/, types/, config/. Not from app/ or features/.
  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/app/*', '@/features/*'], message: 'infrastructure/ must not import from app/ or features/.' },
        ],
      }],
    },
  },

  // ── Layer: features/ — no cross-feature imports ───────────────────────────
  // Each feature may import from infrastructure/, shared/, types/, config/.
  // No feature may import from another feature.
  {
    files: ['src/features/auth/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          // @/features/onedrive-layout/* is intentionally allowed — auth/Header
          // mounts the LayoutToggle shipped by the onedrive-layout feature.
          { group: ['@/features/file-explorer/*', '@/features/profile/*', '@/features/sharing/*', '@/features/validation/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/file-explorer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          // @/features/validation/* is intentionally allowed — it is a pure-service feature
          // with no UI and is consumed by other features as a shared utility.
          { group: ['@/features/auth/*', '@/features/profile/*', '@/features/onedrive-layout/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/profile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/validation/*', '@/features/onedrive-layout/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/sharing/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/profile/*', '@/features/validation/*', '@/features/onedrive-layout/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/validation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/profile/*', '@/features/sharing/*', '@/features/onedrive-layout/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/onedrive-layout/**/*.{ts,tsx}'],
    // The icons/ subdirectory is the SINGLE place permitted to import from
    // @fluentui/react-icons. Excluding it from this block exempts it from
    // BOTH the cross-feature rule AND the @fluentui/react-icons restriction
    // declared below — which is what we want, since the icons module is the
    // canonical re-export entry point everything else imports from.
    ignores: ['src/features/onedrive-layout/icons/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          // @/features/file-explorer/* is intentionally allowed — the OneDrive
          // layout is a re-skin of the classic explorer that reuses its Pod
          // browsing infrastructure (useDriveInitialization, useCatalog,
          // FolderEntry, FileCard, NewFolderInput, FileUpload, UploadTray,
          // DropZone, useFileSearch, useUploadQueue). The two features
          // intentionally share this layer; promoting it into infrastructure/
          // is tracked separately.
          { group: ['@/features/auth/*', '@/features/profile/*', '@/features/sharing/*', '@/features/validation/*'], message: 'Cross-feature imports are not allowed.' },
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },

  // ── Layer: app/ ───────────────────────────────────────────────────────────
  // app/ is the composition root and is intentionally permitted to import
  // from any feature — that is how AppShell wires the OneDriveLayout vs
  // ClassicLayout choice. Documented here so a future maintainer doesn't
  // mistake the absence of a layer rule for an oversight.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@fluentui/react-icons'], message: 'Import icons from @/features/onedrive-layout/icons instead.' },
        ],
      }],
    },
  },

  // ── Layer: e2e/ ───────────────────────────────────────────────────────────
  // Playwright fixture functions destructure the dependency-injection object
  // as their first argument. When a fixture needs none of the available
  // fixtures, the conventional and required signature is `async ({}, provide)`,
  // which trips `no-empty-pattern`. Disable that rule for e2e/.
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
])
