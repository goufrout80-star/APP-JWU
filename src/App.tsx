import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { T } from './lib/theme'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function FullscreenSpinner() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.paper }}>
      <div style={{ width: 26, height: 26, border: `3px solid ${T.hairline}`, borderTopColor: T.tealDeep, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<RequireAuth><Dashboard /></RequireAuth>} />
    </Routes>
  )
}
