import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'
import Borrower from './borrower/Borrower.tsx'
import Board from './board/Board.tsx'
import { DATA_SOURCE } from './hooks/useDesk'

// Phone route: /borrower or #/borrower. Always live (needs Convex).
const isBorrower = window.location.hash.includes('borrower') || window.location.pathname.startsWith('/borrower')
const isBoard = window.location.hash.includes('/board') || window.location.pathname.startsWith('/board')
// One client for the page. ?replay=1 on the desk stays local if the backend is unreachable.
const convex =
  DATA_SOURCE !== 'convex' && !isBorrower
    ? null
    : new ConvexReactClient((import.meta.env.VITE_CONVEX_URL as string | undefined) ?? 'http://127.0.0.1:3210')

const page = isBorrower ? <Borrower /> : isBoard ? <Board /> : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>{convex ? <ConvexProvider client={convex}>{page}</ConvexProvider> : page}</StrictMode>,
)
