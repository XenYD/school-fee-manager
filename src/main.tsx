import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

// Apply saved theme before React renders to avoid flash
;(function () {
  const saved = localStorage.getItem('app-theme') ?? 'dark'
  document.documentElement.setAttribute('data-theme', saved)
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: '10px',
          background: 'var(--c-surface)',
          color: 'var(--c-text-1)',
          border: '1px solid var(--c-border)',
          fontSize: '14px',
          padding: '12px 16px',
          maxWidth: '380px',
          boxShadow: 'var(--shadow-lg)',
        },
        success: {
          iconTheme: { primary: '#2ECC71', secondary: 'var(--c-surface)' },
        },
        error: {
          iconTheme: { primary: '#E74C3C', secondary: 'var(--c-surface)' },
        },
      }}
    />
  </StrictMode>,
)
