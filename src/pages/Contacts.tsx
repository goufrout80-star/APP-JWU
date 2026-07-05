import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useData } from '../lib/data'
import { useIsMobile } from '../lib/breakpoint'
import { downloadCsv } from '../lib/csv'
import { T } from '../lib/theme'
import { PageHeader, Button, Icon, IC, ErrorBanner, SkeletonRows } from '../components/ui'
import { SubmissionDrawer } from '../components/SubmissionDrawer'
import { TableCard, ListShell, MobileCard, Row, th, cell } from '../components/SubmissionTable'
import { Country, TimePill, StatusBadge, Avatar } from '../components/ui'
import { relative } from '../lib/format'
import type { ContactSubmission, Submission } from '../lib/types'

export default function Contacts() {
  const { contacts, loading, error, reload, changeStatus } = useData()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ContactSubmission | null>(null)

  const filtered = contacts.filter((c) => `${c.name} ${c.email} ${c.subject} ${c.meta.country}`.toLowerCase().includes(search.toLowerCase()))

  function exportCsv() {
    downloadCsv('contacts.csv', filtered.map((c) => ({
      name: c.name, email: c.email, subject: c.subject, message: c.message,
      status: c.status, country: c.meta.country, created_at: c.createdAt,
    })))
  }

  return (
    <>
      <PageHeader title="Contacts" description="People who reached out via the contact form"
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Icon d={IC.download} size={15} />Export CSV</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading ? <SkeletonRows rows={5} /> : isMobile ? (
        <ListShell search={search} setSearch={setSearch} count={filtered.length} emptyLabel={contacts.length === 0 ? 'They’ll show up here as soon as someone reaches out.' : 'No contacts match your search.'}>
          {filtered.map((c) => (
            <MobileCard key={c.id} onClick={() => setSelected(c)} isNew={c.status === 'new'} name={c.name} avatarName={c.name} sub={c.subject} status={c.status} meta={c.meta} />
          ))}
        </ListShell>
      ) : (
        <TableCard search={search} setSearch={setSearch} count={filtered.length} emptyLabel={contacts.length === 0 ? 'They’ll show up here as soon as someone reaches out.' : 'No contacts match your search.'}
          head={['Name', 'Subject', 'Country', 'Device', 'Time on site', 'When', 'Status'].map((h) => <th key={h} style={th}>{h}</th>)}>
          {filtered.map((c) => (
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
      )}

      <AnimatePresence>
        {selected && (
          <SubmissionDrawer key={selected.id} item={selected} onClose={() => setSelected(null)}
            onStatus={async (s) => { await changeStatus(selected, s); setSelected((cur) => (cur ? ({ ...cur, status: s } as Submission) as ContactSubmission : cur)) }} />
        )}
      </AnimatePresence>
    </>
  )
}
