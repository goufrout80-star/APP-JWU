import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useData } from '../lib/data'
import { useIsMobile } from '../lib/breakpoint'
import { downloadCsv } from '../lib/csv'
import { T } from '../lib/theme'
import { relative } from '../lib/format'
import { PageHeader, Button, Icon, IC, ErrorBanner, SkeletonRows, Country, TimePill, StatusBadge, Avatar } from '../components/ui'
import { SubmissionDrawer } from '../components/SubmissionDrawer'
import { TableCard, ListShell, MobileCard, Row, th, cell } from '../components/SubmissionTable'
import type { Application, Submission } from '../lib/types'

export default function Applications() {
  const { apps, loading, error, reload, changeStatus, deleteSubmission } = useData()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'creator' | 'brand'>('all')
  const [selected, setSelected] = useState<Application | null>(null)

  const filtered = apps.filter((a) => (filter === 'all' || a.appType === filter) &&
    `${a.appType === 'creator' ? a.name : a.company} ${a.email} ${a.niche ?? ''} ${a.meta.country}`.toLowerCase().includes(search.toLowerCase()))

  function exportCsv() {
    downloadCsv('applications.csv', filtered.map((a) => ({
      type: a.appType,
      name: a.appType === 'creator' ? a.name : a.company,
      email: a.email, niche: a.niche, status: a.status,
      country: a.meta.country, created_at: a.createdAt,
    })))
  }

  const filterTabs = (
    <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 999 }}>
      {(['all', 'creator', 'brand'] as const).map((f) => (
        <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 15px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize', color: filter === f ? '#fff' : T.muted, background: filter === f ? T.ink : 'transparent', transition: 'all .15s' }}>{f}</button>
      ))}
    </div>
  )

  return (
    <>
      <PageHeader title="Applications" description="Creators and brands who applied"
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Icon d={IC.download} size={15} />Export CSV</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading ? <SkeletonRows rows={5} /> : (
        <>
          <div style={{ marginBottom: 14 }}>{filterTabs}</div>
          {isMobile ? (
            <ListShell search={search} setSearch={setSearch} count={filtered.length} emptyLabel={apps.length === 0 ? 'Creators and brands who apply will show up here.' : 'No applications match your search.'}>
              {filtered.map((a) => (
                <MobileCard key={a.id} onClick={() => setSelected(a)} isNew={a.status === 'new'}
                  name={a.appType === 'creator' ? a.name : a.company} avatarName={a.appType === 'creator' ? a.name : a.company}
                  sub={`${a.appType === 'creator' ? 'Creator' : 'Brand'} · ${a.niche ?? '—'}`} status={a.status} meta={a.meta} />
              ))}
            </ListShell>
          ) : (
            <TableCard search={search} setSearch={setSearch} count={filtered.length} emptyLabel={apps.length === 0 ? 'Creators and brands who apply will show up here.' : 'No applications match your search.'}
              head={['Name', 'Type', 'Niche', 'Country', 'Time on site', 'When', 'Status'].map((h) => <th key={h} style={th}>{h}</th>)}>
              {filtered.map((a) => (
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

      <AnimatePresence>
        {selected && (
          <SubmissionDrawer key={selected.id} item={selected} onClose={() => setSelected(null)}
            onDelete={() => deleteSubmission(selected)}
            onStatus={async (s) => { await changeStatus(selected, s); setSelected((cur) => (cur ? ({ ...cur, status: s } as Submission) as Application : cur)) }} />
        )}
      </AnimatePresence>
    </>
  )
}
