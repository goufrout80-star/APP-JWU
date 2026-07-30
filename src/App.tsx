import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { T } from './lib/theme'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MfaSetup from './pages/MfaSetup'
import MfaChallenge from './pages/MfaChallenge'
import Layout, { RequirePageAccess, RequireSuperAdmin } from './components/Layout'
import Overview from './pages/Overview'
import Contacts from './pages/Contacts'
import Applications from './pages/Applications'
import Pages from './pages/Pages'
import PageContacts from './pages/PageContacts'
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

function RequireSecureAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, securityLoading, mfaEnrolled, aal } = useAuth()
  const location = useLocation()
  if (loading || securityLoading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!mfaEnrolled) return <Navigate to="/mfa/setup" replace state={{ from: location }} />
  if (aal !== 'aal2') return <Navigate to="/mfa/challenge" replace state={{ from: location }} />
  return <>{children}</>
}

function RecoveryAwareRoot() {
  const location = useLocation()
  const hasRecoveryCode = new URLSearchParams(location.search).has('code')
  const hasRecoveryTokens = location.hash.includes('access_token=') || location.hash.includes('type=recovery')

  if (hasRecoveryCode || hasRecoveryTokens) {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />
  }

  return <Navigate to="/overview" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RecoveryAwareRoot />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa/setup" element={<RequireAuth><MfaSetup /></RequireAuth>} />
      <Route path="/mfa/challenge" element={<RequireAuth><MfaChallenge /></RequireAuth>} />
      <Route element={<RequireSecureAuth><Layout /></RequireSecureAuth>}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/applications" element={<Applications />} />
        <Route element={<RequirePageAccess />}>
          <Route path="/pages" element={<Pages />} />
          <Route path="/pages/:slug/contacts" element={<PageContacts />} />
        </Route>
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route element={<RequireSuperAdmin />}>
          <Route path="/admins" element={<Admins />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  )
}
