import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { T } from '../lib/theme'
import { Icon, IC, Avatar, RoleBadge } from './ui'

interface NavItem { to: string; label: string; icon: string; superAdminOnly?: boolean }
const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: IC.grid },
  { to: '/contacts', label: 'Contacts', icon: IC.inbox },
  { to: '/applications', label: 'Applications', icon: IC.users },
  { to: '/admins', label: 'Admins / Team', icon: IC.shield, superAdminOnly: true },
  { to: '/analytics', label: 'Analytics', icon: IC.chart },
  { to: '/activity', label: 'Activity Log', icon: IC.activity },
  { to: '/settings', label: 'Settings', icon: IC.settings },
]

function NavRows({ badges, onNavigate }: { badges: Record<string, number>; onNavigate?: () => void }) {
  const { isSuperAdmin } = useAuth()
  return (
    <>
      {NAV.filter((n) => !n.superAdminOnly || isSuperAdmin).map((n) => (
        <NavLink key={n.to} to={n.to} onClick={onNavigate}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '11px 12px', borderRadius: 11,
            textDecoration: 'none', fontSize: 14, fontWeight: 700,
            color: isActive ? T.ink : T.muted, background: isActive ? T.tintTeal : 'transparent', transition: 'background .15s',
          })}>
          {({ isActive }) => (
            <>
              <Icon d={n.icon} size={18} color={isActive ? T.tealInk : T.muted} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {badges[n.to] > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: T.coral, borderRadius: 999, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                  {badges[n.to]}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

function UserFooter() {
  const { user, signOut } = useAuth()
  if (!user) return null
  return (
    <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', gap: 11, padding: '16px 8px 4px' }}>
      <Avatar name={user.name || 'Admin'} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
        <div style={{ marginTop: 2 }}><RoleBadge role={user.role} /></div>
      </div>
      <button onClick={signOut} title="Sign out" style={{ border: `1px solid ${T.hairline}`, background: T.paper, borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.muted, flexShrink: 0 }}>
        <Icon d={IC.out} size={16} />
      </button>
    </div>
  )
}

export function Sidebar({ badges }: { badges: Record<string, number> }) {
  return (
    <aside className="app-sidebar" style={{ borderRight: `1px solid ${T.hairline}`, background: T.surface, padding: '22px 16px', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
        <img src="/favicon.svg" alt="JWU" width={32} height={32} style={{ borderRadius: 9, display: 'block' }} />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 900, fontSize: 14.5, letterSpacing: '-0.02em', color: T.ink }}>JWU Admin</div>
          <div style={{ fontSize: 11, color: T.muted }}>Submissions & team</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: T.muted, padding: '4px 12px 6px' }}>MENU</div>
      <NavRows badges={badges} />
      <UserFooter />
    </aside>
  )
}

export function TopBar({ badges }: { badges: Record<string, number> }) {
  const [open, setOpen] = useState(false)
  const { signOut } = useAuth()
  return (
    <div className="app-topbar" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.hairline}`, background: T.surface, position: 'sticky', top: 0, zIndex: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <img src="/favicon.svg" alt="JWU" width={28} height={28} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 900, fontSize: 14.5, color: T.ink }}>JWU Admin</span>
      </div>
      <button onClick={() => setOpen((o) => !o)} style={{ border: `1px solid ${T.hairline}`, background: T.paper, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={open ? IC.x : IC.grid} size={18} color={T.ink} />
      </button>
      {open && (
        <div style={{ position: 'fixed', top: 62, left: 12, right: 12, background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 16, boxShadow: '0 22px 54px -20px rgba(13,26,20,0.24)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 40 }}>
          <NavRows badges={badges} onNavigate={() => setOpen(false)} />
          <div style={{ height: 1, background: T.hairline, margin: '8px 4px' }} />
          <button onClick={() => { setOpen(false); signOut() }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 11, border: 'none', background: 'transparent', color: T.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            <Icon d={IC.out} size={18} color={T.muted} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
