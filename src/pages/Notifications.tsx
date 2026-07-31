import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import { dateTime } from '../lib/format'
import type { AdminNotification } from '../lib/types'
import { Badge, Button, EmptyState, ErrorBanner, Icon, IC, PageHeader, SkeletonRows, useToast } from '../components/ui'

function eventTone(type: string) {
  if (type.includes('removed') || type.includes('deactivated') || type.includes('revoked')) return { fg: T.coralInk, bg: T.tintCoral }
  if (type.includes('invite') || type.includes('access') || type.includes('role')) return { fg: T.tealInk, bg: T.tintTeal }
  return { fg: T.muted, bg: T.paper }
}

export default function Notifications() {
  const [items, setItems] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { show } = useToast()

  function announceChange() {
    window.dispatchEvent(new CustomEvent('jwu-notifications-changed'))
  }

  function load() {
    setLoading(true)
    setError(null)
    api.listNotifications(100)
      .then(setItems)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load notifications.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items])

  async function markRead(item: AdminNotification) {
    if (item.readAt) return
    try {
      await api.markNotificationRead(item.id)
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row))
      announceChange()
    } catch (markError) {
      show(markError instanceof Error ? markError.message : 'Could not mark the notification as read.', true)
    }
  }

  async function markAll() {
    setBusy(true)
    try {
      await api.markAllNotificationsRead()
      const now = new Date().toISOString()
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })))
      announceChange()
      show('All notifications marked as read.')
    } catch (markError) {
      show(markError instanceof Error ? markError.message : 'Could not update notifications.', true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Notifications" description="Security, invitation, role and managed-page access updates" />
      {error && <ErrorBanner message={error} onRetry={load} />}

      <section style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${T.hairline}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon d={IC.bell} size={17} color={T.tealInk} />
            <span style={{ color: T.ink, fontSize: 13.5, fontWeight: 850 }}>Admin notifications</span>
            <Badge fg={unread ? T.coralInk : T.tealInk} bg={unread ? T.tintCoral : T.tintTeal}>{unread} unread</Badge>
          </div>
          {unread > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void markAll()}>{busy ? 'Updating…' : 'Mark all read'}</Button>}
        </div>

        {loading ? <SkeletonRows rows={5} /> : items.length === 0 ? (
          <EmptyState icon={IC.bell} title="No notifications yet" hint="Team and access events will appear here." />
        ) : items.map((item) => {
          const tone = eventTone(item.type)
          return (
            <button key={item.id} type="button" onClick={() => void markRead(item)}
              style={{ width: '100%', border: 0, borderTop: `1px solid ${T.hairline}`, background: item.readAt ? T.surface : T.tintTeal, padding: '15px 18px', display: 'flex', alignItems: 'flex-start', gap: 13, textAlign: 'left', cursor: item.readAt ? 'default' : 'pointer' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: tone.bg, color: tone.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon d={item.type.includes('invite') ? IC.mail : item.type.includes('access') ? IC.globe : IC.shield} size={18} color={tone.fg} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ color: T.ink, fontSize: 13.5 }}>{item.title}</strong>
                  {!item.readAt && <Badge fg={T.tealInk} bg="#fff" size="sm">New</Badge>}
                </span>
                <span style={{ display: 'block', marginTop: 5, color: T.body, fontSize: 12.8, lineHeight: 1.55 }}>{item.message}</span>
                <span style={{ display: 'block', marginTop: 6, color: T.muted, fontSize: 11.5 }}>{dateTime(item.createdAt)}</span>
              </span>
            </button>
          )
        })}
      </section>
    </>
  )
}
