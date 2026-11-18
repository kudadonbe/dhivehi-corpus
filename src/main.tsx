import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-thaana/thaana-400.css'
import '@fontsource/noto-sans-thaana/thaana-700.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth.tsx'
import { UiTextProvider } from './ui/i18n.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiTextProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiTextProvider>
  </StrictMode>,
)
