import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { api, IS_SUPABASE_CONFIGURED } from '../lib/api'
import type {
  Application, ContactSubmission, Submission, VisitorMeta,
  ContactStatus, ApplicationStatus,
} from '../lib/types'
import { T, SHADOW } from '../lib/theme'
import { flag, duration, dateTime, relative } from '../lib/format'
import { useIsMobile } from '../lib/breakpoint'

type Tab = 'overview' | 'contacts' | 'applications'
const EASE = [0.22, 1, 0.36, 1] as const

/* ── icons ──────────────────────────────────────────────────── */
function Icon({ d, size = 18, color = 'currentColor', sw = 1.8 }: { d: string; size?: number; color?: string; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}
const IC = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  inbox: 'M3 12h5l2 3h4l2-3h5M5 6h14l2 6v6H3v-6l2-6Z',
  users: 'M16 11a4 4 0 1 0-8 0M2 21a6 6 0 0 1 12 0M17 11a4 4 0 0 1 5 6',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.4 2.4 3.6 6 3.6 9S14.4 18.6 12 21c-2.4-2.4-3.6-6-3.6-9S9.6 5.4 12 3Z',
  mail: 'M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  device: 'M5 4h14a1 1 0 0 1 1 1v10H4V5a1 1 0 0 1 1-1ZM2 19h20M9 19l1 2h4l1-2',
  link: 'M10 14a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  out: 'M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M14 4h6v6M10 14 20 4',
}

/* ── avatar (initials, colour from string) ──────────────────── */
const AV_BG = [T.tintTeal, T.tintCoral, T.tintLilac, T.tintSky, T.tintSun]
const AV_FG = [T.tealInk, T.coralInk, T.lilac, T.sky, '#A9791C']
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const i = name.charCodeAt(0) % AV_BG.length
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: 999, background: AV_BG[i], color: AV_FG[i], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36 }}>{initials}</span>
  )
}

/* ── status ─────────────────────────────────────────────────── */
const STATUS: Record<string, { fg: string; bg: string }> = {
  new: { fg: T.coralInk, bg: T.tintCoral },
  read: { fg: T.sky, bg: T.tintSky },
  reviewing: { fg: '#A9791C', bg: T.tintSun },
  replied: { fg: T.tealInk, bg: T.tintTeal },
  accepted: { fg: T.tealInk, bg: T.tintTeal },
  rejected: { fg: '#8a938d', bg: '#F1F2F0' },
  archived: { fg: '#8a938d', bg: '#F1F2F0' },
}
function StatusBadge({ s }: { s: string }) {
  const c = STATUS[s] ?? STATUS.archived
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.02em', color: c.fg, background: c.bg, textTransform: 'capitalize' }}><span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />{s}</span>
}
const CONTACT_STATUSES: ContactStatus[] = ['new', 'read', 'replied', 'archived']
const APP_STATUSES: ApplicationStatus[] = ['new', 'reviewing', 'accepted', 'rejected']

function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (s: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {options.map((o) => {
        const on = o === value
        const c = STATUS[o] ?? STATUS.archived
        return (
          <button key={o} onClick={() => onChange(o)}
            style={{ padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize', transition: 'all .15s',
              border: `1.5px solid ${on ? c.fg : T.hairline}`, background: on ? c.bg : T.surface, color: on ? c.fg : T.muted }}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Country({ m }: { m: VisitorMeta }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: T.ink }}><span style={{ fontSize: 15 }}>{flag(m.countryCode)}</span>{m.country ?? 'Unknown'}{m.city ? <span style={{ color: T.muted, fontWeight: 400 }}>· {m.city}</span> : null}</span>
}

/* ── animated count-up ──────────────────────────────────────── */
function useCountUp(target: number, run: boolean) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (reduce) { setN(target); return }
    let raf = 0; const start = performance.now(); const dur = 900
    const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); setN(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [target, run, reduce])
  return n
}

function StatCard({ icon, label, value, isTime, hint, accent, bg, i }: { icon: string; label: string; value: number; isTime?: boolean; hint?: string; accent: string; bg: string; i: number }) {
  const n = useCountUp(value, true)
  const display = isTime ? duration(n) : Math.round(n).toLocaleString()
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
      style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, padding: 22, boxShadow: SHADOW.soft }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: bg, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={icon} size={20} color={accent} /></span>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.muted, marginTop: 16 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', color: T.ink, marginTop: 4 }}>{display}</div>
      {hint && <div style={{ fontSize: 12.5, color: accent, fontWeight: 700, marginTop: 2 }}>{hint}</div>}
    </motion.div>
  )
}

/* ── tables ─────────────────────────────────────────────────── */
const th: React.CSSProperties = { padding: '12px 18px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, textAlign: 'left', background: T.paper }
const cell: React.CSSProperties = { padding: '13px 18px', fontSize: 13.5, color: T.body, borderTop: `1px solid ${T.hairline}`, textAlign: 'left', verticalAlign: 'middle' }
function TimePill({ sec }: { sec: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: T.tintTeal, color: T.tealInk, fontSize: 12, fontWeight: 800 }}><Icon d={IC.clock} size={13} color={T.tealInk} />{duration(sec)}</span>
}
function Row({ children, onClick, isNew }: { children: React.ReactNode; onClick: () => void; isNew: boolean }) {
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }} onMouseEnter={(e) => (e.currentTarget.style.background = T.paper)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <td style={{ ...cell, width: 4, padding: 0 }}>{isNew && <span style={{ display: 'block', width: 3, height: 28, borderRadius: 999, background: T.coral, marginLeft: 2 }} />}</td>
      {children}
    </tr>
  )
}
function TableCard({ search, setSearch, head, children, count, emptyLabel }: { search: string; setSearch: (v: string) => void; head: React.ReactNode; children: React.ReactNode; count: number; emptyLabel: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, overflow: 'hidden', boxShadow: SHADOW.soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${T.hairline}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flex: 1, padding: '9px 13px', borderRadius: 11, background: T.paper, border: `1px solid ${T.hairline}` }}>
          <Icon d={IC.search} size={16} color={T.muted} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, country…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: T.ink }} />
        </span>
        <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 700 }}>{count} total</span>
      </div>
      {count === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>{emptyLabel}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table><thead><tr><th style={{ ...th, width: 4, padding: 0 }} />{head}</tr></thead><tbody>{children}</tbody></table>
        </div>
      )}
    </div>
  )
}

/* ── mobile: cards instead of a horizontally-scrolling table ── */
function ListShell({ search, setSearch, children, count, emptyLabel }: { search: string; setSearch: (v: string) => void; children: React.ReactNode; count: number; emptyLabel: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 11, background: T.surface, border: `1px solid ${T.hairline}`, marginBottom: 14 }}>
        <Icon d={IC.search} size={16} color={T.muted} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, country…" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: T.ink }} />
      </div>
      {count === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      )}
    </div>
  )
}
function MobileCard({ onClick, isNew, name, avatarName, sub, status, meta }: { onClick: () => void; isNew: boolean; name: string; avatarName: string; sub: string; status: string; meta: VisitorMeta }) {
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

/* ── detail drawer (with editable status) ───────────────────── */
function Meta({ icon, label, children }: { icon?: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: `1px solid ${T.hairline}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.muted, fontWeight: 600, flexShrink: 0 }}>{icon && <Icon d={icon} size={15} color={T.muted} />}{label}</span>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.tealInk, margin: '24px 0 2px' }}>{children}</div>
}

function Drawer({ item, onClose, onStatus }: { item: Submission; onClose: () => void; onStatus: (s: string) => void }) {
  const m = item.meta
  const title = item.kind === 'contact' ? item.name : item.kind === 'application' && item.appType === 'creator' ? item.name : item.company
  const email = item.email
  const accent = item.kind === 'contact' ? T.tealInk : T.coralInk
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,0.32)', zIndex: 40 }} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 94vw)', background: T.surface, boxShadow: SHADOW.lift, zIndex: 50, overflowY: 'auto' }}>
        {/* header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${T.hairline}`, background: T.paper }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <Avatar name={title} size={48} />
              <div>
                <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: T.ink }}>{title}</div>
                <a href={`mailto:${email}`} style={{ fontSize: 13.5, color: accent, fontWeight: 600 }}>{email}</a>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: T.surface, borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.muted, boxShadow: SHADOW.soft }}><Icon d={IC.x} size={17} /></button>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <a href={`mailto:${email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, background: T.tealDeep, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}><Icon d={IC.mail} size={15} color="#fff" /> Reply</a>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 14px', borderRadius: 10, background: T.surface, border: `1px solid ${T.hairline}`, fontSize: 12.5, color: T.muted, fontWeight: 700 }}>{dateTime(item.createdAt)}</span>
          </div>
        </div>

        <div style={{ padding: '4px 26px 32px' }}>
          {/* editable status */}
          <SectionLabel>Status</SectionLabel>
          <div style={{ marginTop: 8 }}>
            <StatusSelect value={item.status} options={item.kind === 'contact' ? CONTACT_STATUSES : APP_STATUSES} onChange={onStatus} />
          </div>

          {/* submission body */}
          {item.kind === 'contact' ? (
            <>
              <SectionLabel>Message</SectionLabel>
              <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 700, marginTop: 6 }}>{item.subject}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: T.body, marginTop: 8, background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 14 }}>{item.message}</p>
              <Meta label="Audience">{item.audience}</Meta>
            </>
          ) : item.appType === 'creator' ? (
            <>
              <SectionLabel>Creator</SectionLabel>
              <Meta label="Handle">{item.handle ?? '—'}</Meta>
              <Meta label="Niche">{item.niche ?? '—'}</Meta>
              <Meta label="Platform">{item.platform ?? '—'}</Meta>
              <Meta label="Audience size">{item.audienceSize ?? '—'}</Meta>
              <Meta icon={IC.link} label="Content">{item.contentLink ? <a href={item.contentLink} target="_blank" rel="noreferrer" style={{ color: T.coralInk }}>open ↗</a> : '—'}</Meta>
            </>
          ) : (
            <>
              <SectionLabel>Brand</SectionLabel>
              <Meta label="Website">{item.website ?? '—'}</Meta>
              <Meta label="Niche">{item.niche ?? '—'}</Meta>
              <Meta label="Budget range">{item.budgetRange ?? '—'}</Meta>
              <Meta label="Campaign goal">{item.campaignGoal ?? '—'}</Meta>
            </>
          )}

          <SectionLabel>Visitor</SectionLabel>
          <Meta icon={IC.globe} label="Country">{flag(m.countryCode)} {m.country ?? 'Unknown'}{m.city ? ` · ${m.city}` : ''}</Meta>
          <Meta label="Timezone">{m.timezone ?? '—'}</Meta>
          <Meta icon={IC.device} label="Device">{m.device} · {m.os} · {m.browser}</Meta>

          <SectionLabel>Session</SectionLabel>
          <Meta icon={IC.clock} label="Time on site"><span style={{ color: T.tealInk, fontWeight: 800 }}>{duration(m.timeOnSiteSec)}</span></Meta>
          <Meta label="Pages viewed">{m.pageViews}</Meta>
          <Meta label="Referrer">{m.referrer}</Meta>
          <Meta label="Landed on">{m.landingPath}</Meta>
          <Meta label="Submitted from">{m.submitPath}</Meta>
        </div>
      </motion.div>
    </>
  )
}

/* ── overview ───────────────────────────────────────────────── */
function BarList({ rows }: { rows: { label: string; code: string | null; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: T.ink, fontWeight: 600 }}>{flag(r.code)} {r.label}</span>
            <span style={{ color: T.muted, fontWeight: 700 }}>{r.count}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: T.paper, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.7, ease: EASE }} style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${T.tealDeep}, ${T.teal})` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Overview({ contacts, apps, onOpen }: { contacts: ContactSubmission[]; apps: Application[]; onOpen: (s: Submission) => void }) {
  const all: Submission[] = useMemo(() => [...contacts, ...apps], [contacts, apps])
  const avgTime = all.length ? Math.round(all.reduce((s, x) => s + x.meta.timeOnSiteSec, 0) / all.length) : 0
  const countries = useMemo(() => {
    const c: Record<string, { count: number; code: string | null }> = {}
    all.forEach((x) => { const k = x.meta.country ?? 'Unknown'; c[k] = { count: (c[k]?.count ?? 0) + 1, code: x.meta.countryCode } })
    return Object.entries(c).map(([label, v]) => ({ label, code: v.code, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [all])
  const recent = useMemo(() => [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [all])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <StatCard i={0} icon={IC.inbox} label="Contacts" value={contacts.length} hint={`${contacts.filter((c) => c.status === 'new').length} new`} accent={T.tealInk} bg={T.tintTeal} />
        <StatCard i={1} icon={IC.users} label="Applications" value={apps.length} hint={`${apps.filter((a) => a.status === 'new').length} new`} accent={T.coralInk} bg={T.tintCoral} />
        <StatCard i={2} icon={IC.clock} label="Avg time on site" value={avgTime} isTime hint="before submitting" accent={T.lilac} bg={T.tintLilac} />
        <StatCard i={3} icon={IC.globe} label="Countries" value={countries.length} hint="reaching out" accent={T.sky} bg={T.tintSky} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 18, marginTop: 18, alignItems: 'start' }} className="ov-grid">
        {/* recent */}
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', fontSize: 14, fontWeight: 800, color: T.ink, borderBottom: `1px solid ${T.hairline}` }}>Recent activity</div>
          {recent.length === 0 && <div style={{ padding: '32px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>Nothing yet.</div>}
          {recent.map((x, i) => {
            const name = x.kind === 'contact' ? x.name : x.kind === 'application' && x.appType === 'creator' ? x.name : x.company
            return (
              <motion.div key={x.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                onClick={() => onOpen(x)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: i ? `1px solid ${T.hairline}` : undefined, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.paper)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Avatar name={name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{name}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{flag(x.meta.countryCode)} {x.meta.country} · {duration(x.meta.timeOnSiteSec)} on site</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: x.kind === 'contact' ? T.tealInk : T.coralInk, background: x.kind === 'contact' ? T.tintTeal : T.tintCoral, padding: '4px 9px', borderRadius: 999 }}>{x.kind === 'contact' ? 'Contact' : 'Apply'}</span>
                <span style={{ fontSize: 12, color: T.muted, minWidth: 54, textAlign: 'right' }}>{relative(x.createdAt)}</span>
              </motion.div>
            )
          })}
        </div>
        {/* countries */}
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 16 }}>Where they're from</div>
          {countries.length === 0 ? <div style={{ color: T.muted, fontSize: 13.5, textAlign: 'center', padding: '12px 0' }}>Nothing yet.</div> : <BarList rows={countries} />}
        </div>
      </div>
    </>
  )
}

/* ── shell ──────────────────────────────────────────────────── */
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: IC.grid },
  { id: 'contacts', label: 'Contacts', icon: IC.inbox },
  { id: 'applications', label: 'Applications', icon: IC.users },
]

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('overview')
  const [contacts, setContacts] = useState<ContactSubmission[]>([])
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [cSearch, setCSearch] = useState('')
  const [aSearch, setASearch] = useState('')
  const [aFilter, setAFilter] = useState<'all' | 'creator' | 'brand'>('all')

  function load() {
    setLoading(true); setError(null)
    Promise.all([api.listContacts(), api.listApplications()])
      .then(([c, a]) => { setContacts(c); setApps(a) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function changeStatus(item: Submission, status: string) {
    try {
      if (item.kind === 'contact') {
        await api.setContactStatus(item.id, status as ContactStatus)
        setContacts((cs) => cs.map((c) => (c.id === item.id ? { ...c, status: status as ContactStatus } : c)))
      } else {
        await api.setApplicationStatus(item.id, status as ApplicationStatus)
        setApps((as) => as.map((a) => (a.id === item.id ? { ...a, status: status as ApplicationStatus } : a)))
      }
      setSelected((s) => (s && s.id === item.id ? ({ ...s, status } as Submission) : s))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status.')
    }
  }

  const newCount = contacts.filter((c) => c.status === 'new').length + apps.filter((a) => a.status === 'new').length
  const navCount: Record<Tab, number> = {
    overview: 0,
    contacts: contacts.filter((c) => c.status === 'new').length,
    applications: apps.filter((a) => a.status === 'new').length,
  }

  const filteredContacts = contacts.filter((c) => `${c.name} ${c.email} ${c.subject} ${c.meta.country}`.toLowerCase().includes(cSearch.toLowerCase()))
  const filteredApps = apps.filter((a) => (aFilter === 'all' || a.appType === aFilter) && `${a.appType === 'creator' ? a.name : a.company} ${a.email} ${a.niche ?? ''} ${a.meta.country}`.toLowerCase().includes(aSearch.toLowerCase()))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', minHeight: '100dvh', background: T.paper }}>
      {/* sidebar */}
      <aside style={{ borderRight: `1px solid ${T.hairline}`, background: T.surface, padding: '22px 16px', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100dvh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
          <img src="/favicon.svg" alt="JWU" width={32} height={32} style={{ borderRadius: 9, display: 'block' }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 900, fontSize: 14.5, letterSpacing: '-0.02em', color: T.ink }}>JWU Admin</div>
            <div style={{ fontSize: 11, color: T.muted }}>Submissions</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: T.muted, padding: '4px 12px 6px' }}>MENU</div>
        {NAV.map((n) => {
          const on = tab === n.id
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '11px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: on ? T.ink : T.muted, background: on ? T.tintTeal : 'transparent', transition: 'background .15s' }}>
              <Icon d={n.icon} size={18} color={on ? T.tealInk : T.muted} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {navCount[n.id] > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: T.coral, borderRadius: 999, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{navCount[n.id]}</span>}
            </button>
          )
        })}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', gap: 11, padding: '16px 8px 4px' }}>
          <Avatar name={user?.name || 'Admin'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, textTransform: 'capitalize' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
          <button onClick={signOut} title="Sign out" style={{ border: `1px solid ${T.hairline}`, background: T.paper, borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.muted }}><Icon d={IC.out} size={16} /></button>
        </div>
      </aside>

      {/* content */}
      <main style={{ padding: 'clamp(20px,3vw,34px)', maxWidth: 1180 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 900, letterSpacing: '-0.03em', color: T.ink, margin: 0, textTransform: 'capitalize' }}>{tab}</h1>
            <p style={{ fontSize: 13.5, color: T.muted, margin: '4px 0 0' }}>
              {tab === 'overview' ? `${newCount} new submission${newCount === 1 ? '' : 's'} waiting` : tab === 'contacts' ? 'People who reached out via the contact form' : 'Creators and brands who applied'}
            </p>
          </div>
          {!IS_SUPABASE_CONFIGURED && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: '#A9791C', background: T.tintSun, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}><span style={{ width: 7, height: 7, borderRadius: 999, background: '#A9791C' }} />Supabase not configured</span>}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.tintCoral, border: `1px solid ${T.coral}55`, borderRadius: 14, padding: '13px 16px', marginBottom: 18, fontSize: 13.5, color: T.coralInk }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={load} style={{ border: 'none', background: T.coral, color: '#fff', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ color: T.muted, fontSize: 14, padding: 60, textAlign: 'center' }}>Loading…</div>
        ) : error ? null : tab === 'overview' ? (
          <Overview contacts={contacts} apps={apps} onOpen={setSelected} />
        ) : tab === 'contacts' ? (
          isMobile ? (
            <ListShell search={cSearch} setSearch={setCSearch} count={filteredContacts.length} emptyLabel={contacts.length === 0 ? 'No contacts yet — they’ll show up here as soon as someone reaches out.' : 'No contacts match your search.'}>
              {filteredContacts.map((c) => (
                <MobileCard key={c.id} onClick={() => setSelected(c)} isNew={c.status === 'new'} name={c.name} avatarName={c.name} sub={c.subject} status={c.status} meta={c.meta} />
              ))}
            </ListShell>
          ) : (
          <TableCard search={cSearch} setSearch={setCSearch} count={filteredContacts.length} emptyLabel={contacts.length === 0 ? 'No contacts yet — they’ll show up here as soon as someone reaches out.' : 'No contacts match your search.'}
            head={['Name', 'Subject', 'Country', 'Device', 'Time on site', 'When', 'Status'].map((h) => <th key={h} style={th}>{h}</th>)}>
            {filteredContacts.map((c) => (
              <Row key={c.id} onClick={() => setSelected(c)} isNew={c.status === 'new'}>
                <td style={cell}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={c.name} size={36} /><div><div style={{ fontWeight: 700, color: T.ink }}>{c.name}</div><div style={{ fontSize: 12, color: T.muted }}>{c.email}</div></div></div></td>
                <td style={cell}>{c.subject}</td>
                <td style={cell}><Country m={c.meta} /></td>
                <td style={cell}>{c.meta.device}</td>
                <td style={cell}><TimePill sec={c.meta.timeOnSiteSec} /></td>
                <td style={cell}>{relative(c.createdAt)}</td>
                <td style={cell}><StatusBadge s={c.status} /></td>
              </Row>
            ))}
          </TableCard>
          )
        ) : (
          <>
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 999, marginBottom: 14 }}>
              {(['all', 'creator', 'brand'] as const).map((f) => (
                <button key={f} onClick={() => setAFilter(f)} style={{ padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: aFilter === f ? '#fff' : T.muted, background: aFilter === f ? T.ink : 'transparent', transition: 'all .15s' }}>{f}</button>
              ))}
            </div>
            {isMobile ? (
              <ListShell search={aSearch} setSearch={setASearch} count={filteredApps.length} emptyLabel={apps.length === 0 ? 'No applications yet — creators and brands who apply will show up here.' : 'No applications match your search.'}>
                {filteredApps.map((a) => (
                  <MobileCard key={a.id} onClick={() => setSelected(a)} isNew={a.status === 'new'}
                    name={a.appType === 'creator' ? a.name : a.company}
                    avatarName={a.appType === 'creator' ? a.name : a.company}
                    sub={`${a.appType === 'creator' ? 'Creator' : 'Brand'} · ${a.niche ?? '—'}`}
                    status={a.status} meta={a.meta} />
                ))}
              </ListShell>
            ) : (
            <TableCard search={aSearch} setSearch={setASearch} count={filteredApps.length} emptyLabel={apps.length === 0 ? 'No applications yet — creators and brands who apply will show up here.' : 'No applications match your search.'}
              head={['Name', 'Type', 'Niche', 'Country', 'Time on site', 'When', 'Status'].map((h) => <th key={h} style={th}>{h}</th>)}>
              {filteredApps.map((a) => (
                <Row key={a.id} onClick={() => setSelected(a)} isNew={a.status === 'new'}>
                  <td style={cell}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={a.appType === 'creator' ? a.name : a.company} size={36} /><div><div style={{ fontWeight: 700, color: T.ink }}>{a.appType === 'creator' ? a.name : a.company}</div><div style={{ fontSize: 12, color: T.muted }}>{a.appType === 'creator' ? a.handle : a.website}</div></div></div></td>
                  <td style={cell}><span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'capitalize', color: a.appType === 'creator' ? T.coralInk : T.tealInk, background: a.appType === 'creator' ? T.tintCoral : T.tintTeal, padding: '4px 10px', borderRadius: 999 }}>{a.appType}</span></td>
                  <td style={cell}>{a.niche ?? '—'}</td>
                  <td style={cell}><Country m={a.meta} /></td>
                  <td style={cell}><TimePill sec={a.meta.timeOnSiteSec} /></td>
                  <td style={cell}>{relative(a.createdAt)}</td>
                  <td style={cell}><StatusBadge s={a.status} /></td>
                </Row>
              ))}
            </TableCard>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {selected && <Drawer key={selected.id} item={selected} onClose={() => setSelected(null)} onStatus={(s) => changeStatus(selected, s)} />}
      </AnimatePresence>
    </div>
  )
}
