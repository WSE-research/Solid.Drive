/**
 * Application entry point.
 * Initializes i18n, renders the root App component in StrictMode.
 *
 * @packageDocumentation
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/i18n'
import './app/index.css'
import App from './app/App'
import { applyStoredTheme } from '@/features/onedrive-layout/hooks/useThemePreference'
import { registerServiceWorker } from '@/shared/utils/registerServiceWorker'

applyStoredTheme()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the PWA service worker so the app is installable and can boot
// its shell offline. Fire-and-forget; failures must not block start-up.
void registerServiceWorker()
