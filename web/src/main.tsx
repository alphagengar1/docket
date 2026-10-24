import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'
import { DATA_SOURCE } from './hooks/useDesk'

// One client for the page. If the backend is unreachable the hook falls back to loading/empty state; ?replay=1 stays local.
const convex = DATA_SOURCE !== 'convex' ? null : new ConvexReactClient((import.meta.env.VITE_CONVEX_URL as string | undefined) ?? 'http://127.0.0.1:3210')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
