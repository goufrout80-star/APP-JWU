/* ════════════════════════════════════════════════════════════════
   Shared UI primitives used across every admin page — keeping these
   in one place is what makes the whole app look like one consistent
   product instead of seven pages that each reinvented buttons/badges.
   ════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { T, SHADOW } from '../lib/theme'
import { flag, duration } from '../lib/format'
import type { VisitorMeta } from '../lib/types'

export const EASE = [0.22, 1, 0.36, 1] as const

/* ── icons ──────────────────────────────────────────────────── */
export function Icon({ d, size = 18, color = 'currentColor', sw = 1.8 }: { d: string; size?: number; color?: string; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}
export const IC = {
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
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z',
  chart: 'M4 20V10M12 20V4M20 20v-7',
  bell: 'M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6ZM10 21a2 2 0 0 0 4 0',
  download: 'M12 3v13M7 11l5 5 5-5M4 21h16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  warning: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  note: 'M4 4h16v13l-4 4H4V4Z M15 21v-4h4',
  activity: 'M3 12h4l2 7 4-14 2 7h4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
}

/* ── avatar (initials, colour from string) ──────────────────── */
const AV_BG = [T.tintTeal, T.tintCoral, T.tintLilac, T.tintSky, T.tintSun]
const AV_FG = [T.tealInk, T.coralInk, T.lilac, T.sky, '#A9791C']
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const i = name.charCodeAt(0) % AV_BG.length
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: 999, background: AV_BG[i], color: AV_FG[i], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36 }}>{initials}</span>
  )
}

/* ── generic badge (role/status pill) ──────────────────────── */
export function Badge({ children, fg, bg, size = 'md' }: { children: ReactNode; fg: string; bg: string; size?: 'sm' | 'md' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '3px 9px' : '4px 11px', borderRadius: 999, fontSize: size === 'sm' ? 10.5 : 11.5, fontWeight: 800, letterSpacing: '0.02em', color: fg, background: bg }}>
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: 'admin' | 'super_admin' }) {
  return role === 'super_admin'
    ? <Badge fg={T.coralInk} bg={T.tintCoral}><Icon d={IC.shield} size={11} color={T.coralInk} />Super Admin</Badge>
    : <Badge fg={T.muted} bg={T.paper}>Admin</Badge>
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
export function StatusBadge({ s }: { s: string }) {
  const c = STATUS[s] ?? STATUS.archived
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.02em', color: c.fg, background: c.bg, textTransform: 'capitalize' }}><span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />{s}</span>
}
export function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (s: string) => void }) {
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

export function Country({ m }: { m: VisitorMeta }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: T.ink }}><span style={{ fontSize: 15 }}>{flag(m.countryCode)}</span>{m.country ?? 'Unknown'}{m.city ? <span style={{ color: T.muted, fontWeight: 400 }}>· {m.city}</span> : null}</span>
}

export function TimePill({ sec }: { sec: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: T.tintTeal, color: T.tealInk, fontSize: 12, fontWeight: 800 }}><Icon d={IC.clock} size={13} color={T.tealInk} />{duration(sec)}</span>
}

/* ── buttons ────────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'danger' | 'ghost' | 'outline'
const BTN_STYLE: Record<BtnVariant, React.CSSProperties> = {
  primary: { background: T.tealDeep, color: '#fff', border: 'none' },
  danger: { background: T.coral, color: '#fff', border: 'none' },
  outline: { background: T.surface, color: T.ink, border: `1px solid ${T.hairline}` },
  ghost: { background: 'transparent', color: T.muted, border: 'none' },
}
export function Button({ children, onClick, variant = 'outline', disabled, type = 'button', size = 'md' }:
  { children: ReactNode; onClick?: () => void; variant?: BtnVariant; disabled?: boolean; type?: 'button' | 'submit'; size?: 'sm' | 'md' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        ...BTN_STYLE[variant],
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: size === 'sm' ? '7px 13px' : '10px 18px', borderRadius: 11,
        fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, transition: 'filter .15s, opacity .15s', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.96)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}>
      {children}
    </button>
  )
}

/* ── confirm dialog — required before any destructive action ── */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }:
  { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}
            style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,0.4)', zIndex: 90 }} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(420px, 92vw)', background: T.surface, borderRadius: 18, boxShadow: SHADOW.lift, zIndex: 91, padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: danger ? T.tintCoral : T.tintSun, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon d={IC.warning} size={19} color={danger ? T.coralInk : '#A9791C'} />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>{title}</div>
                <div style={{ fontSize: 13.5, color: T.body, marginTop: 6, lineHeight: 1.5 }}>{body}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 22 }}>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── empty / loading / error states ────────────────────────── */
export function EmptyState({ icon = IC.inbox, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div style={{ padding: '56px 20px', textAlign: 'center' }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, background: T.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon d={icon} size={24} color={T.muted} />
      </span>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{title}</div>
      {hint && <div style={{ fontSize: 13, color: T.muted, marginTop: 4, maxWidth: 320, margin: '4px auto 0' }}>{hint}</div>}
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: number | string; radius?: number }) {
  return <div className="skel-block" style={{ height, width, borderRadius: radius, background: T.paper }} />
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton height={36} width={36} radius={999} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton height={12} width="40%" />
            <Skeleton height={10} width="65%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.tintCoral, border: `1px solid ${T.coral}55`, borderRadius: 14, padding: '13px 16px', marginBottom: 18, fontSize: 13.5, color: T.coralInk }}>
      <Icon d={IC.warning} size={17} color={T.coralInk} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && <Button variant="danger" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

/* ── page header ────────────────────────────────────────────── */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 27, fontWeight: 900, letterSpacing: '-0.03em', color: T.ink, margin: 0 }}>{title}</h1>
        {description && <p style={{ fontSize: 13.5, color: T.muted, margin: '4px 0 0' }}>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

/* ── toast — app-wide via context (ToastProvider mounted once in
   Layout), so any component can call useToast().show() and have it
   actually render, instead of each caller getting an isolated
   instance whose own <Toast/> JSX never gets mounted. ────────── */
const ToastCtx = createContext<{ show: (text: string, danger?: boolean) => void }>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; danger?: boolean } | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <ToastCtx.Provider value={{ show: (text, danger) => setMsg({ text, danger }) }}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: msg.danger ? T.coral : T.ink, color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, boxShadow: SHADOW.lift }}>
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  )
}
export function useToast() {
  return useContext(ToastCtx)
}

export function useCountUp(target: number, run: boolean) {
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

export function StatCard({ icon, label, value, isTime, hint, accent, bg, i }: { icon: string; label: string; value: number; isTime?: boolean; hint?: string; accent: string; bg: string; i: number }) {
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
