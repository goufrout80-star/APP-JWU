import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { T } from './lib/theme'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Layout, { RequireSuperAdmin } from './components/Layout'
import Overview from './pages/Overview'
import Contacts from './pages/Contacts'
import Applications from './pages/Applications'
import Admins from './pages/Admins'
import Analytics from './pages/Analytics'
import ActivityLog from './pages/ActivityLog'
import Settings from './pages/Settings'

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
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route element={<RequireSuperAdmin />}>
          <Route path="/admins" element={<Admins />} />
        </Route>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  )
}
