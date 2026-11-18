import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

// Code-split: the documentation page (and the files it embeds) loads only when visited.
const InfrastructurePage = lazy(() => import('./pages/InfrastructurePage'))

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="infrastructure"
          element={
            <Suspense fallback={<p className="container section muted">Loading…</p>}>
              <InfrastructurePage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
