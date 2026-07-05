import type { ReactNode } from 'react'
import { T, SHADOW } from '../lib/theme'
import type { VisitorMeta } from '../lib/types'
import { Icon, IC, Avatar, StatusBadge, Country, TimePill, EmptyState } from './ui'

export const th: React.CSSProperties = { padding: '12px 18px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, textAlign: 'left', background: T.paper }
export const cell: React.CSSProperties = { padding: '13px 18px', fontSize: 13.5, color: T.body, borderTop: `1px solid ${T.hairline}`, textAlign: 'left', verticalAlign: 'middle' }

export function Row({ children, onClick, isNew }: { children: ReactNode; onClick: () => void; isNew: boolean }) {
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }} onMouseEnter={(e) => (e.currentTarget.style.background = T.paper)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <td style={{ ...cell, width: 4, padding: 0 }}>{isNew && <span style={{ display: 'block', width: 3, height: 28, borderRadius: 999, background: T.coral, marginLeft: 2 }} />}</td>
      {children}
    </tr>
  )
}

export function TableCard({ search, setSearch, head, children, count, emptyLabel, toolbar }:
  { search: string; setSearch: (v: string) => void; head: ReactNode; children: ReactNode; count: number; emptyLabel: string; toolbar?: ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, overflow: 'hidden', boxShadow: SHADOW.soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${T.hairline}`, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 200, padding: '9px 13px', borderRadius: 11, background: T.paper, border: `1px solid ${T.hairline}` }}>
          <Icon d={IC.search} size={16} color={T.muted} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, country…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: T.ink }} />
        </span>
        {toolbar}
        <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 700 }}>{count} total</span>
      </div>
      {count === 0 ? (
        <EmptyState icon={IC.inbox} title="Nothing here yet" hint={emptyLabel} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table><thead><tr><th style={{ ...th, width: 4, padding: 0 }} />{head}</tr></thead><tbody>{children}</tbody></table>
        </div>
      )}
    </div>
  )
}

export function ListShell({ search, setSearch, children, count, emptyLabel }: { search: string; setSearch: (v: string) => void; children: ReactNode; count: number; emptyLabel: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 11, background: T.surface, border: `1px solid ${T.hairline}`, marginBottom: 14 }}>
        <Icon d={IC.search} size={16} color={T.muted} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, country…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: T.ink }} />
      </div>
      {count === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 16 }}>
          <EmptyState icon={IC.inbox} title="Nothing here yet" hint={emptyLabel} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      )}
    </div>
  )
}

export function MobileCard({ onClick, isNew, name, avatarName, sub, status, meta }: { onClick: () => void; isNew: boolean; name: string; avatarName: string; sub: string; status: string; meta: VisitorMeta }) {
  return (
    <button onClick={onClick} style={{ position: 'relative', textAlign: 'left', display: 'block', width: '100%', background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 16, padding: '14px 16px', boxShadow: SHADOW.soft, cursor: 'pointer' }}>
      {isNew && <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 999, background: T.coral }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={avatarName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: T.ink, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
        </div>
        <StatusBadge s={status} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <Country m={meta} />
        <span style={{ color: T.hairline }}>·</span>
        <TimePill sec={meta.timeOnSiteSec} />
      </div>
    </button>
  )
}
