import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import { dateTime } from '../lib/format'
import type { AdminInvite, AdminRecord, AdminRole, ManagedPage, PageAccessLevel } from '../lib/types'
import { PageHeader, Button, Icon, IC, Avatar, RoleBadge, Badge, ConfirmDialog, EmptyState, SkeletonRows, ErrorBanner, useToast } from '../components/ui'
import { PageAccessPanel } from '../components/PageAccessPanel'

function inviteStatus(invite: AdminInvite) {
  const config = {
    pending: { label: 'Pending', fg: T.tealInk, bg: T.tintTeal },
    accepted: { label: 'Accepted', fg: T.tealInk, bg: T.tintTeal },
    failed: { label: 'Delivery failed', fg: T.coralInk, bg: T.tintCoral },
    expired: { label: 'Expired', fg: '#8A6A1E', bg: T.tintSun },
    revoked: { label: 'Revoked', fg: T.muted, bg: T.paper },
  }[invite.status]
  return <Badge fg={config.fg} bg={config.bg} size="sm">{config.label}</Badge>
}

function InviteAdminForm({ pages, onInvited }: { pages: ManagedPage[]; onInvited: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [pageAccess, setPageAccess] = useState<Record<string, PageAccessLevel>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { show } = useToast()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = displayName.trim()
    if (cleanName.length < 2) { setErr('Enter the team member’s name.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) { setErr('Enter a valid email address.'); return }

    setSaving(true)
    setErr(null)
    try {
      await api.inviteAdmin(cleanEmail, cleanName, role, role === 'super_admin' ? {} : pageAccess)
      setDisplayName('')
      setEmail('')
      setRole('admin')
      setPageAccess({})
      onInvited()
      show(`Secure invitation sent to ${cleanEmail}.`)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to send the invitation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, .8fr) minmax(230px, 1.2fr) 160px auto', gap: 10, alignItems: 'start' }} className="admin-invite-form">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Team member name" autoComplete="name"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, outline: 'none', color: T.ink }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@justwhyus.com" type="email" autoComplete="email"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, outline: 'none', color: T.ink }} />
        <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}
          style={{ padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, color: T.ink, background: T.surface }}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <Button type="submit" variant="primary" disabled={saving || !email.trim() || !displayName.trim()}>
          <Icon d={IC.mail} size={15} color="#fff" />{saving ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
      {role === 'super_admin' ? (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: T.tintCoral, color: T.coralInk, fontSize: 12.5, lineHeight: 1.5 }}>
          Super Admin has full team, data and managed-page control. The invitee must still create a password and enable MFA.
        </div>
      ) : pages.length > 0 ? (
        <div style={{ marginTop: 12, padding: '13px 14px', borderRadius: 12, border: `1px solid ${T.hairline}`, background: T.paper }}>
          <div style={{ marginBottom: 9, color: T.ink, fontSize: 12.5, fontWeight: 850 }}>Optional managed-page access</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {pages.map((page) => (
              <div key={page.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: T.ink, fontSize: 12.5, fontWeight: 750 }}>{page.name}</div>
                  <div style={{ color: T.muted, fontSize: 11.2 }}>{page.domain}</div>
                </div>
                <select value={pageAccess[page.id] || 'none'} onChange={(event) => {
                  const level = event.target.value as PageAccessLevel | 'none'
                  setPageAccess((current) => {
                    const next = { ...current }
                    if (level === 'none') delete next[page.id]
                    else next[page.id] = level
                    return next
                  })
                }} style={{ minWidth: 128, padding: '7px 10px', borderRadius: 9, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, fontSize: 12 }}>
                  <option value="none">No access</option>
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {err && <div role="alert" style={{ fontSize: 12.5, color: T.coralInk, marginTop: 9 }}>{err}</div>}
      <style>{'@media(max-width:900px){.admin-invite-form{grid-template-columns:1fr 1fr!important}}@media(max-width:620px){.admin-invite-form{grid-template-columns:1fr!important}}'}</style>
    </form>
  )
}

function InviteRow({ invite, onChanged }: { invite: AdminInvite; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const { show } = useToast()
  const actionable = invite.status === 'pending' || invite.status === 'failed' || invite.status === 'expired'

  async function resend() {
    setBusy(true)
    try {
      await api.resendAdminInvite(invite.id)
      show(`New invitation sent to ${invite.email}.`)
      onChanged()
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not resend the invitation.', true)
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      await api.revokeAdminInvite(invite.id)
      show(`Invitation for ${invite.email} revoked.`)
      onChanged()
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not revoke the invitation.', true)
    } finally {
      setBusy(false)
      setConfirmRevoke(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', borderTop: `1px solid ${T.hairline}` }}>
        <Avatar name={invite.displayName || invite.email} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 850, color: T.ink }}>{invite.displayName || invite.email.split('@')[0]}</span>
            {inviteStatus(invite)}
            <RoleBadge role={invite.role} />
          </div>
          <div style={{ marginTop: 3, color: T.muted, fontSize: 11.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.email}</div>
          <div style={{ marginTop: 4, color: T.muted, fontSize: 11.5 }}>
            {invite.status === 'accepted' && invite.acceptedAt ? `Accepted ${dateTime(invite.acceptedAt)}` : `Expires ${dateTime(invite.expiresAt)}`} · sent {invite.sentCount} time{invite.sentCount === 1 ? '' : 's'}
          </div>
          {invite.lastError && <div style={{ marginTop: 4, color: T.coralInk, fontSize: 11.5 }}>{invite.lastError}</div>}
        </div>
        {actionable && (
          <div style={{ display: 'flex', gap: 7, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void resend()}>{busy ? 'Working…' : 'Resend'}</Button>
            {invite.status !== 'expired' && <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirmRevoke(true)}>Revoke</Button>}
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmRevoke} title="Revoke this invitation?" danger
        body={<>The link sent to <b>{invite.email}</b> will no longer activate admin access.</>}
        confirmLabel="Revoke invitation" onCancel={() => setConfirmRevoke(false)} onConfirm={() => void revoke()} />
    </>
  )
}

function AdminRow({ admin, isSelf, onChanged }: { admin: AdminRecord; isSelf: boolean; onChanged: () => void }) {
  const [confirm, setConfirm] = useState<'deactivate' | 'reactivate' | 'remove' | 'promote' | 'demote' | null>(null)
  const [busy, setBusy] = useState(false)
  const { show } = useToast()

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true)
    try {
      await action()
      show(okMsg)
      onChanged()
    } catch (error) {
      show(error instanceof Error ? error.message : 'Action failed.', true)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  function requestRole(nextRole: AdminRole) {
    if (nextRole === admin.role) return
    setConfirm(nextRole === 'super_admin' ? 'promote' : 'demote')
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
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <select value={admin.role} disabled={busy} onChange={(e) => requestRole(e.target.value as AdminRole)}
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

      <ConfirmDialog open={confirm === 'promote'} title="Promote to Super Admin?"
        body={<><b>{admin.email}</b> will receive full access to the team, submissions, settings and every managed page. A notification email will be sent.</>}
        confirmLabel="Promote" onCancel={() => setConfirm(null)} onConfirm={() => run(() => api.setAdminRole(admin.email, 'super_admin'), `${admin.email} promoted to Super Admin.`)} />
      <ConfirmDialog open={confirm === 'demote'} title="Change to Admin?" danger
        body={<><b>{admin.email}</b> will lose Super Admin control. Managed-page access remains controlled separately below.</>}
        confirmLabel="Change role" onCancel={() => setConfirm(null)} onConfirm={() => run(() => api.setAdminRole(admin.email, 'admin'), `${admin.email} changed to Admin.`)} />
      <ConfirmDialog open={confirm === 'deactivate'} title="Deactivate this admin?" danger
        body={<>This immediately revokes <b>{admin.email}</b>&apos;s access to contacts, applications, managed pages, and all admin data. They will receive a notification email.</>}
        confirmLabel="Deactivate" onCancel={() => setConfirm(null)} onConfirm={() => run(() => api.setAdminActive(admin.email, false), `${admin.email} deactivated.`)} />
      <ConfirmDialog open={confirm === 'reactivate'} title="Reactivate this admin?"
        body={<>Restores <b>{admin.email}</b>&apos;s core admin access. MFA remains required.</>}
        confirmLabel="Reactivate" onCancel={() => setConfirm(null)} onConfirm={() => run(() => api.setAdminActive(admin.email, true), `${admin.email} reactivated.`)} />
      <ConfirmDialog open={confirm === 'remove'} title="Remove this admin?" danger
        body={<>Permanently removes <b>{admin.email}</b> from the admin list and revokes managed-page access. The authentication account is kept for security records.</>}
        confirmLabel="Remove" onCancel={() => setConfirm(null)} onConfirm={() => run(() => api.removeAdmin(admin.email), `${admin.email} removed.`)} />
    </>
  )
}

export default function Admins() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminRecord[]>([])
  const [invites, setInvites] = useState<AdminInvite[]>([])
  const [pages, setPages] = useState<ManagedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([api.listAdmins(), api.listAdminInvites(), api.listManagedPages()])
      .then(([adminRows, inviteRows, pageRows]) => { setAdmins(adminRows); setInvites(inviteRows); setPages(pageRows) })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load team access.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openInvites = useMemo(() => invites.filter((invite) => ['pending', 'failed', 'expired'].includes(invite.status)), [invites])
  const inviteHistory = useMemo(() => invites.filter((invite) => ['accepted', 'revoked'].includes(invite.status)).slice(0, 12), [invites])

  return (
    <>
      <PageHeader title="Admins / Team" description="Invite team members, require secure onboarding, and control roles and managed-page access" />
      {error && <ErrorBanner message={error} onRetry={load} />}

      <section style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.ink }}>Invite a new admin</div>
            <p style={{ margin: '5px 0 0', color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>They receive a branded JWU email, create their own password, and must enable authenticator MFA.</p>
          </div>
          <Badge fg={T.tealInk} bg={T.tintTeal}>Secure 48-hour invite</Badge>
        </div>
        <InviteAdminForm pages={pages} onInvited={load} />
      </section>

      <section style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 850, color: T.ink }}>Pending invitations</div>
          <Badge fg={openInvites.length ? T.coralInk : T.tealInk} bg={openInvites.length ? T.tintCoral : T.tintTeal}>{openInvites.length}</Badge>
        </div>
        {loading ? <SkeletonRows rows={2} /> : openInvites.length === 0 ? (
          <div style={{ borderTop: `1px solid ${T.hairline}` }}><EmptyState icon={IC.mail} title="No pending invitations" hint="New invitations and delivery problems will appear here." /></div>
        ) : openInvites.map((invite) => <InviteRow key={invite.id} invite={invite} onChanged={load} />)}
        {!loading && inviteHistory.length > 0 && (
          <details style={{ borderTop: `1px solid ${T.hairline}` }}>
            <summary style={{ padding: '13px 20px', cursor: 'pointer', color: T.muted, fontSize: 12.5, fontWeight: 750 }}>Recent invitation history ({inviteHistory.length})</summary>
            {inviteHistory.map((invite) => <InviteRow key={invite.id} invite={invite} onChanged={load} />)}
          </details>
        )}
      </section>

      <section style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', fontSize: 13, fontWeight: 800, color: T.ink, borderBottom: `1px solid ${T.hairline}` }}>{admins.length} active or historical admin{admins.length === 1 ? '' : 's'}</div>
        {loading ? <SkeletonRows rows={3} /> : admins.length === 0 ? (
          <EmptyState icon={IC.shield} title="No admins found" />
        ) : admins.map((admin) => <AdminRow key={admin.email} admin={admin} isSelf={admin.email.toLowerCase() === user?.email.toLowerCase()} onChanged={load} />)}
      </section>

      {!loading && admins.length > 0 && <PageAccessPanel admins={admins} />}
    </>
  )
}
