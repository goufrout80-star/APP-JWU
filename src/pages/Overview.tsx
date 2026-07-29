import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../lib/data'
import { T, SHADOW } from '../lib/theme'
import { flag, duration, relative } from '../lib/format'
import { IC, Avatar, StatCard, PageHeader, ErrorBanner, SkeletonRows, EmptyState } from '../components/ui'
import { SubmissionDrawer } from '../components/SubmissionDrawer'
import type { Submission } from '../lib/types'

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
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.7 }} style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${T.tealDeep}, ${T.teal})` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Overview() {
  const { contacts, apps, loading, error, reload, changeStatus, deleteSubmission } = useData()
  const [selected, setSelected] = useState<Submission | null>(null)
  const all: Submission[] = useMemo(() => [...contacts, ...apps], [contacts, apps])
  const avgTime = all.length ? Math.round(all.reduce((s, x) => s + x.meta.timeOnSiteSec, 0) / all.length) : 0
  const countries = useMemo(() => {
    const c: Record<string, { count: number; code: string | null }> = {}
    all.forEach((x) => { const k = x.meta.country ?? 'Unknown'; c[k] = { count: (c[k]?.count ?? 0) + 1, code: x.meta.countryCode } })
    return Object.entries(c).map(([label, v]) => ({ label, code: v.code, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [all])
  const recent = useMemo(() => [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [all])
  const newCount = contacts.filter((c) => c.status === 'new').length + apps.filter((a) => a.status === 'new').length

  return (
    <>
      <PageHeader title="Overview" description={`${newCount} new submission${newCount === 1 ? '' : 's'} waiting`} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            <StatCard i={0} icon={IC.inbox} label="Contacts" value={contacts.length} hint={`${contacts.filter((c) => c.status === 'new').length} new`} accent={T.tealInk} bg={T.tintTeal} />
            <StatCard i={1} icon={IC.users} label="Applications" value={apps.length} hint={`${apps.filter((a) => a.status === 'new').length} new`} accent={T.coralInk} bg={T.tintCoral} />
            <StatCard i={2} icon={IC.clock} label="Avg time on site" value={avgTime} isTime hint="before submitting" accent={T.lilac} bg={T.tintLilac} />
            <StatCard i={3} icon={IC.globe} label="Countries" value={countries.length} hint="reaching out" accent={T.sky} bg={T.tintSky} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 18, marginTop: 18, alignItems: 'start' }} className="ov-grid">
            <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', fontSize: 14, fontWeight: 800, color: T.ink, borderBottom: `1px solid ${T.hairline}` }}>Recent activity</div>
              {recent.length === 0 && <EmptyState icon={IC.inbox} title="Nothing yet" hint="New contacts and applications will show up here." />}
              {recent.map((x, i) => {
                const name = x.kind === 'contact' ? x.name : x.kind === 'application' && x.appType === 'creator' ? x.name : x.company
                return (
                  <motion.div key={x.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                    onClick={() => setSelected(x)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: i ? `1px solid ${T.hairline}` : undefined, cursor: 'pointer' }}
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
            <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 16 }}>Where they're from</div>
              {countries.length === 0 ? <div style={{ color: T.muted, fontSize: 13.5, textAlign: 'center', padding: '12px 0' }}>Nothing yet.</div> : <BarList rows={countries} />}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {selected && (
          <SubmissionDrawer key={selected.id} item={selected} onClose={() => setSelected(null)}
            onDelete={() => deleteSubmission(selected)}
            onStatus={async (s) => { await changeStatus(selected, s); setSelected((cur) => (cur ? ({ ...cur, status: s } as Submission) : cur)) }} />
        )}
      </AnimatePresence>
    </>
  )
}
