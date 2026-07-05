import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useData } from '../lib/data'
import { T, SHADOW } from '../lib/theme'
import { PageHeader, ErrorBanner, SkeletonRows, EmptyState, IC } from '../components/ui'
import type { Submission } from '../lib/types'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function DailyBars({ all }: { all: Submission[] }) {
  const days = useMemo(() => {
    const now = new Date()
    const buckets: { label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const count = all.filter((x) => x.createdAt.slice(0, 10) === key).length
      buckets.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), count })
    }
    return buckets
  }, [all])
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
      {days.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>{d.count || ''}</div>
          <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (d.count / max) * 100)}px` }} transition={{ duration: 0.5, delay: i * 0.03 }}
            style={{ width: '100%', borderRadius: 5, background: d.count ? `linear-gradient(180deg, ${T.teal}, ${T.tealDeep})` : T.paper }} />
          <div style={{ fontSize: 10, color: T.muted }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function DistributionBar({ rows }: { rows: { label: string; count: number; color: string }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: T.paper }}>
        {rows.map((r) => r.count > 0 && (
          <div key={r.label} style={{ width: `${(r.count / total) * 100}%`, background: r.color }} title={`${r.label}: ${r.count}`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.body }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />
            {r.label} <b style={{ color: T.ink }}>{r.count}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  const { contacts, apps, loading, error, reload } = useData()
  const all = useMemo(() => [...contacts, ...apps], [contacts, apps])

  const deviceRows = useMemo(() => {
    const c: Record<string, number> = {}
    all.forEach((x) => { c[x.meta.device] = (c[x.meta.device] ?? 0) + 1 })
    const colors: Record<string, string> = { Desktop: T.tealDeep, Mobile: T.coral, Tablet: T.lilac }
    return Object.entries(c).map(([label, count]) => ({ label, count, color: colors[label] ?? T.sky }))
  }, [all])

  const statusRows = useMemo(() => {
    const c: Record<string, number> = {}
    all.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1 })
    const colors: Record<string, string> = { new: T.coral, read: T.sky, replied: T.tealDeep, reviewing: T.sun, accepted: T.tealDeep, rejected: '#8a938d', archived: '#8a938d' }
    return Object.entries(c).map(([label, count]) => ({ label, count, color: colors[label] ?? T.muted }))
  }, [all])

  const kindRows = useMemo(() => ([
    { label: 'Contacts', count: contacts.length, color: T.tealDeep },
    { label: 'Applications', count: apps.length, color: T.coral },
  ]), [contacts, apps])

  const referrers = useMemo(() => {
    const c: Record<string, number> = {}
    all.forEach((x) => { const r = x.meta.referrer || 'Direct'; c[r] = (c[r] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [all])

  return (
    <>
      <PageHeader title="Analytics" description="Submission trends and breakdowns across contacts and applications" />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading ? <SkeletonRows rows={4} /> : all.length === 0 ? (
        <EmptyState icon={IC.chart} title="Nothing to analyze yet" hint="Charts will fill in once contacts and applications start coming in." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }} className="ov-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Card title="Submissions — last 14 days">
              <DailyBars all={all} />
            </Card>
          </div>
          <Card title="Contacts vs. applications"><DistributionBar rows={kindRows} /></Card>
          <Card title="By device"><DistributionBar rows={deviceRows} /></Card>
          <Card title="By status"><DistributionBar rows={statusRows} /></Card>
          <Card title="Top referrers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {referrers.map(([r, count]) => (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{r}</span>
                  <span style={{ color: T.muted, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
