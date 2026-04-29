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
          { group: ['@/features/file-explorer/*', '@/features/profile/*', '@/features/sharing/*', '@/features/validation/*'], message: 'Cross-feature imports are not allowed.' },
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
          { group: ['@/features/auth/*', '@/features/profile/*'], message: 'Cross-feature imports are not allowed.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/profile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/validation/*'], message: 'Cross-feature imports are not allowed.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/sharing/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/profile/*', '@/features/validation/*'], message: 'Cross-feature imports are not allowed.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/validation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/auth/*', '@/features/file-explorer/*', '@/features/profile/*', '@/features/sharing/*'], message: 'Cross-feature imports are not allowed.' },
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
