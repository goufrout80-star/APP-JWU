import { useEffect, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { DataProvider, useData } from '../lib/data'
import { useSessionTimeout } from '../lib/useSessionTimeout'
import { ToastProvider } from './ui'
import { T } from '../lib/theme'
import { Sidebar, TopBar } from './Sidebar'

function Shell() {
  const { contacts, apps } = useData()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  useSessionTimeout()

  useEffect(() => {
    let active = true
    let timer = 0

    async function loadNotificationCount() {
      try {
        const rows = await api.listNotifications(100)
        if (active) setUnreadNotifications(rows.filter((row) => !row.readAt).length)
      } catch {
        if (active) setUnreadNotifications(0)
      }
    }

    const onChanged = () => void loadNotificationCount()
    void loadNotificationCount()
    window.addEventListener('jwu-notifications-changed', onChanged)
    timer = window.setInterval(loadNotificationCount, 60_000)

    return () => {
      active = false
      window.removeEventListener('jwu-notifications-changed', onChanged)
      window.clearInterval(timer)
    }
  }, [])

  const badges: Record<string, number> = {
    '/contacts': contacts.filter((c) => c.status === 'new').length,
    '/applications': apps.filter((a) => a.status === 'new').length,
    '/notifications': unreadNotifications,
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

export function RequirePageAccess() {
  const { hasPageAccess, loading, securityLoading, aal } = useAuth()
  if (loading || securityLoading) return null
  if (!hasPageAccess || aal !== 'aal2') return <Navigate to="/overview" replace />
  return <Outlet />
}
