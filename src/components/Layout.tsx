import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { DataProvider, useData } from '../lib/data'
import { useSessionTimeout } from '../lib/useSessionTimeout'
import { ToastProvider } from './ui'
import { T } from '../lib/theme'
import { Sidebar, TopBar } from './Sidebar'

function Shell() {
  const { contacts, apps } = useData()
  useSessionTimeout()
  const badges: Record<string, number> = {
    '/contacts': contacts.filter((c) => c.status === 'new').length,
    '/applications': apps.filter((a) => a.status === 'new').length,
  }
  return (
    <div className="app-shell" style={{ display: 'grid', gridTemplateColumns: '248px 1fr', minHeight: '100dvh', background: T.paper }}>
      <Sidebar badges={badges} />
      <div style={{ minWidth: 0 }}>
        <TopBar badges={badges} />
        <main style={{ padding: 'clamp(20px,3vw,34px)', maxWidth: 1180 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <ToastProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </ToastProvider>
  )
}

export function RequireSuperAdmin() {
  const { isSuperAdmin, loading, aal } = useAuth()
  if (loading) return null
  if (!isSuperAdmin || aal !== 'aal2') return <Navigate to="/overview" replace />
  return <Outlet />
}
