import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import { relative, dateTime } from '../lib/format'
import type { ActivityLogEntry } from '../lib/types'
import { PageHeader, ErrorBanner, SkeletonRows, EmptyState, Icon, IC, Button } from '../components/ui'

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  status_changed: { label: 'Status changed', icon: IC.check, color: T.tealInk },
  note_added: { label: 'Note added', icon: IC.note, color: T.lilac },
  admin_added: { label: 'Admin added', icon: IC.plus, color: T.tealInk },
  admin_removed: { label: 'Admin removed', icon: IC.trash, color: T.coralInk },
  admin_deactivated: { label: 'Admin deactivated', icon: IC.warning, color: T.coralInk },
  admin_reactivated: { label: 'Admin reactivated', icon: IC.check, color: T.tealInk },
  admin_role_changed: { label: 'Role changed', icon: IC.shield, color: '#A9791C' },
}

function describe(entry: ActivityLogEntry): string {
  const d = entry.detail as Record<string, unknown>
  switch (entry.action) {
    case 'status_changed':
      return `${entry.actorEmail.split('@')[0]} moved ${String(d.name ?? entry.targetType)} from "${d.from}" to "${d.to}"`
    case 'note_added':
      return `${entry.actorEmail.split('@')[0]} added a note on a ${entry.targetType}`
    case 'admin_added':
      return `${entry.actorEmail.split('@')[0]} added ${entry.targetId} as ${d.role === 'super_admin' ? 'Super Admin' : 'Admin'}`
    case 'admin_removed':
      return `${entry.actorEmail.split('@')[0]} removed ${entry.targetId} from admins`
    case 'admin_deactivated':
      return `${entry.actorEmail.split('@')[0]} deactivated ${entry.targetId}`
    case 'admin_reactivated':
      return `${entry.actorEmail.split('@')[0]} reactivated ${entry.targetId}`
    case 'admin_role_changed':
      return `${entry.actorEmail.split('@')[0]} changed ${entry.targetId}'s role from ${d.from} to ${d.to}`
    default:
      return `${entry.actorEmail.split('@')[0]} — ${entry.action}`
  }
}

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true); setError(null)
    api.listActivityLog(150).then(setEntries).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load activity log.')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <>
      <PageHeader title="Activity Log" description="Every status change, note, and admin change — recorded automatically, not editable"
        actions={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>} />
      {error && <ErrorBanner message={error} onRetry={load} />}
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
        {loading ? <SkeletonRows rows={6} /> : entries.length === 0 ? (
          <EmptyState icon={IC.activity} title="No activity yet" hint="Status changes, notes, and admin/team changes will show up here as they happen." />
        ) : (
          entries.map((e, i) => {
            const meta = ACTION_META[e.action] ?? { label: e.action, icon: IC.dots, color: T.muted }
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 20px', borderTop: i ? `1px solid ${T.hairline}` : undefined }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: `${meta.color}18`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon d={meta.icon} size={15} color={meta.color} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>{describe(e)}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{dateTime(e.createdAt)}</div>
                </div>
                <span style={{ fontSize: 11.5, color: T.muted, flexShrink: 0 }}>{relative(e.createdAt)}</span>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
