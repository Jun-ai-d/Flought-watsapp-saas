import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { isFrontendConfigured } from './lib/env'
import ConfigError from './components/ConfigError'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'

const LazyReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({
    default: m.ReactQueryDevtools,
  })),
)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root element not found')
}

const root = ReactDOM.createRoot(rootEl)

function renderFatalError(message: string) {
  root.render(
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Frontend failed to start</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      </div>
    </div>,
  )
}

try {
  if (!isFrontendConfigured) {
    root.render(<ConfigError />)
  } else {
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <HelmetProvider>
              <AuthProvider>
                <ThemeProvider>
                  <App />
                </ThemeProvider>
              </AuthProvider>
            </HelmetProvider>
          </BrowserRouter>
          {import.meta.env.DEV ? (
            <Suspense fallback={null}>
              <LazyReactQueryDevtools initialIsOpen={false} />
            </Suspense>
          ) : null}
        </QueryClientProvider>
      </React.StrictMode>,
    )
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error'
  renderFatalError(message)
}
