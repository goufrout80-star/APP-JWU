import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import type { AdminPageAccess, AdminRecord, ManagedPage, PageAccessLevel } from '../lib/types'
import { Avatar, Badge, ErrorBanner, Icon, IC, useToast } from './ui'

export function PageAccessPanel({ admins }: { admins: AdminRecord[] }) {
  const [pages, setPages] = useState<ManagedPage[]>([])
  const [access, setAccess] = useState<AdminPageAccess[]>([])
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { show } = useToast()

  function load() {
    setError(null)
    Promise.all([api.listManagedPages(), api.listAdminPageAccess()])
      .then(([pageRows, accessRows]) => { setPages(pageRows); setAccess(accessRows) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load page permissions.'))
  }

  useEffect(load, [])

  const accessMap = useMemo(() => new Map(access.map((row) => [`${row.adminUserId}:${row.pageId}`, row.accessLevel])), [access])

  async function change(admin: AdminRecord, page: ManagedPage, level: PageAccessLevel | 'none') {
    const key = `${admin.userId}:${page.id}`
    setBusyKey(key)
    try {
      await api.setAdminPageAccess(admin.userId, page.id, level)
      show(level === 'none' ? `${admin.email} can no longer access ${page.name}.` : `${admin.email} now has ${level} access to ${page.name}.`)
      load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not update page access.', true)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <section style={{ marginTop: 18, background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink, fontSize: 14, fontWeight: 900 }}><Icon d={IC.globe} size={17} color={T.tealInk} />Managed page access</div>
          <p style={{ margin: '6px 0 0', color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>AuraX has full access as Super Admin. Grant Viewer access to read page contacts or Manager access to update their workflow.</p>
        </div>
        <Badge fg={T.tealInk} bg={T.tintTeal}>AuraX controls access</Badge>
      </div>
      {error && <div style={{ padding: 16 }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!error && pages.length === 0 && <div style={{ padding: 20, color: T.muted, fontSize: 13 }}>No managed pages are configured yet.</div>}
      {pages.map((page) => (
        <div key={page.id} style={{ borderTop: `1px solid ${T.hairline}` }}>
          <div style={{ padding: '13px 20px', background: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ color: T.ink, fontSize: 13.5 }}>{page.name}</strong><div style={{ color: T.muted, fontSize: 11.5, marginTop: 2 }}>{page.domain}</div></div>
            <Badge fg={T.tealInk} bg={T.tintTeal}>Contacts enabled</Badge>
          </div>
          {admins.map((admin) => {
            const isSuper = admin.role === 'super_admin'
            const current = isSuper ? 'manager' : accessMap.get(`${admin.userId}:${page.id}`) ?? 'none'
            const key = `${admin.userId}:${page.id}`
            return (
              <div key={admin.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderTop: `1px solid ${T.hairline}`, opacity: admin.active ? 1 : .55 }}>
                <Avatar name={admin.displayName || admin.email} size={35} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.ink, fontSize: 13, fontWeight: 800 }}>{admin.displayName || admin.email.split('@')[0]}</div>
                  <div style={{ color: T.muted, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</div>
                </div>
                {isSuper ? (
                  <Badge fg={T.coralInk} bg={T.tintCoral}>Full access</Badge>
                ) : (
                  <select value={current} disabled={!admin.active || busyKey === key} onChange={(e) => void change(admin, page, e.target.value as PageAccessLevel | 'none')}
                    style={{ padding: '8px 11px', minWidth: 132, borderRadius: 9, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, fontSize: 12.5, fontWeight: 700 }}>
                    <option value="none">No access</option>
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
