import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import { dateTime } from '../lib/format'
import type { AdminRecord, AdminRole } from '../lib/types'
import { PageHeader, Button, Icon, IC, Avatar, RoleBadge, Badge, ConfirmDialog, EmptyState, SkeletonRows, ErrorBanner, useToast } from '../components/ui'

function AddAdminForm({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { show } = useToast()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) { setErr('Enter a valid email address.'); return }
    setSaving(true); setErr(null)
    try {
      await api.addAdmin(trimmed, role)
      setEmail(''); setRole('admin')
      onAdded()
      show(`${trimmed} added as ${role === 'super_admin' ? 'Super Admin' : 'Admin'}.`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to add admin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new-admin@justwhyus.com" type="email"
          style={{ width: '100%', padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, outline: 'none', color: T.ink }} />
        {err && <div style={{ fontSize: 12, color: T.coralInk, marginTop: 6 }}>{err}</div>}
      </div>
      <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}
        style={{ padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, color: T.ink, background: T.surface }}>
        <option value="admin">Admin</option>
        <option value="super_admin">Super Admin</option>
      </select>
      <Button type="submit" variant="primary" disabled={saving || !email.trim()}>
        <Icon d={IC.plus} size={15} color="#fff" />{saving ? 'Adding…' : 'Add admin'}
      </Button>
    </form>
  )
}

function AdminRow({ admin, isSelf, onChanged }: { admin: AdminRecord; isSelf: boolean; onChanged: () => void }) {
  const [confirm, setConfirm] = useState<'deactivate' | 'reactivate' | 'remove' | null>(null)
  const [busy, setBusy] = useState(false)
  const { show } = useToast()

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true)
    try {
      await action()
      show(okMsg)
      onChanged()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Action failed.', true)
    } finally {
      setBusy(false); setConfirm(null)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: `1px solid ${T.hairline}`, opacity: admin.active ? 1 : 0.55 }}>
        <Avatar name={admin.displayName || admin.email} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{admin.displayName || admin.email.split('@')[0]}</span>
            <RoleBadge role={admin.role} />
            {!admin.active && <Badge fg="#8a938d" bg="#F1F2F0" size="sm">Deactivated</Badge>}
            {isSelf && <Badge fg={T.tealInk} bg={T.tintTeal} size="sm">You</Badge>}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email} · added {dateTime(admin.createdAt)}</div>
        </div>
        {!isSelf && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <select value={admin.role} disabled={busy}
              onChange={(e) => run(() => api.setAdminRole(admin.email, e.target.value as AdminRole), `Role updated for ${admin.email}.`)}
              style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${T.hairline}`, fontSize: 12.5, color: T.ink, background: T.surface }}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(admin.active ? 'deactivate' : 'reactivate')}>
              {admin.active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirm('remove')}>
              <Icon d={IC.trash} size={13} color="#fff" />
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'deactivate'} title="Deactivate this admin?" danger
        body={<>This immediately revokes <b>{admin.email}</b>'s access to contacts, applications, and all admin data — enforced server-side, not just hidden in the UI.</>}
        confirmLabel="Deactivate" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.setAdminActive(admin.email, false), `${admin.email} deactivated.`)} />
      <ConfirmDialog
        open={confirm === 'reactivate'} title="Reactivate this admin?"
        body={<>Restores <b>{admin.email}</b>'s access immediately.</>}
        confirmLabel="Reactivate" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.setAdminActive(admin.email, true), `${admin.email} reactivated.`)} />
      <ConfirmDialog
        open={confirm === 'remove'} title="Remove this admin?" danger
        body={<>Permanently removes <b>{admin.email}</b> from the admin list. This can't be undone from here — you'd need to add them back manually.</>}
        confirmLabel="Remove" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.removeAdmin(admin.email), `${admin.email} removed.`)} />
    </>
  )
}

export default function Admins() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true); setError(null)
    api.listAdmins().then(setAdmins).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load admins.')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <>
      <PageHeader title="Admins / Team" description="Who has access to the admin dashboard, and what they can do" />
      {error && <ErrorBanner message={error} onRetry={load} />}
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 12 }}>Add a new admin</div>
        <AddAdminForm onAdded={load} />
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', fontSize: 13, fontWeight: 800, color: T.ink, borderBottom: `1px solid ${T.hairline}` }}>{admins.length} admin{admins.length === 1 ? '' : 's'}</div>
        {loading ? <SkeletonRows rows={3} /> : admins.length === 0 ? (
          <EmptyState icon={IC.shield} title="No admins found" />
        ) : (
          admins.map((a) => <AdminRow key={a.email} admin={a} isSelf={a.email.toLowerCase() === user?.email.toLowerCase()} onChanged={load} />)
        )}
      </div>
    </>
  )
}
