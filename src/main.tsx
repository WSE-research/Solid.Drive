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
import { registerServiceWorker } from '@/app/registerServiceWorker'

applyStoredTheme()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
