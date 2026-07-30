import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../lib/breakpoint'
import { dateTime, relative } from '../lib/format'
import { T, SHADOW } from '../lib/theme'
import type { ContactStatus, ManagedPage, PageContact } from '../lib/types'
import { PageHeader, Icon, IC, ErrorBanner, SkeletonRows, StatusBadge, StatusSelect, Avatar, Badge, Country } from '../components/ui'
import { TableCard, ListShell, MobileCard, Row, th, cell } from '../components/SubmissionTable'

const STATUSES: ContactStatus[] = ['new', 'read', 'replied', 'archived']

function safeUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function reference(item: PageContact) {
  return `TFM-${new Date(item.createdAt).getUTCFullYear()}-${item.id.slice(0, 6).toUpperCase()}`
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '125px 1fr', gap: 14, padding: '10px 0', borderTop: `1px solid ${T.hairline}` }}>
      <span style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{label}</span>
      <div style={{ color: T.ink, fontSize: 13, fontWeight: 650, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: '23px 0 7px', color: T.tealInk, fontSize: 10.5, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>{children}</div>
}

function PageContactDrawer({ page, item, onClose, onStatus }: { page: ManagedPage; item: PageContact; onClose: () => void; onStatus: (status: ContactStatus) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const website = safeUrl(item.website)
  const canManage = page.accessLevel === 'manager'

  async function change(status: string) {
    if (!canManage || busy) return
    setBusy(true)
    setError('')
    try { await onStatus(status as ContactStatus) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update status.') }
    finally { setBusy(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,.34)', zIndex: 60 }} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px,96vw)', background: T.surface, zIndex: 70, overflowY: 'auto', boxShadow: SHADOW.lift }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 2, padding: '20px 24px', background: T.paper, borderBottom: `1px solid ${T.hairline}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
              <Avatar name={item.name} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: T.muted, fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>{page.name}</div>
                <h2 style={{ margin: '4px 0 2px', color: T.ink, fontSize: 20, letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h2>
                <a href={`mailto:${item.email}`} style={{ color: T.tealInk, fontSize: 13, fontWeight: 700 }}>{item.email}</a>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close contact" style={{ width: 36, height: 36, border: `1px solid ${T.hairline}`, background: T.surface, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon d={IC.x} size={17} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <a href={`mailto:${item.email}?subject=${encodeURIComponent(`${reference(item)} · Today Film Makers partnership inquiry`)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10, background: T.tealDeep, color: '#fff', fontSize: 12.5, fontWeight: 800 }}><Icon d={IC.mail} size={14} color="#fff" />Reply</a>
            <Badge fg={T.muted} bg={T.surface}>{reference(item)}</Badge>
            <Badge fg={canManage ? T.tealInk : T.muted} bg={canManage ? T.tintTeal : T.surface}>{canManage ? 'Manager access' : 'Viewer access'}</Badge>
          </div>
        </header>

        <div style={{ padding: '4px 24px 32px' }}>
          <Section>Status</Section>
          {canManage ? <StatusSelect value={item.status} options={STATUSES} onChange={change} /> : <StatusBadge s={item.status} />}
          {busy && <div style={{ marginTop: 7, color: T.muted, fontSize: 12 }}>Updating status…</div>}
          {error && <div role="alert" style={{ marginTop: 7, color: T.coralInk, fontSize: 12 }}>{error}</div>}

          <Section>Brand and contact</Section>
          <DetailRow label="Company">{item.company || 'Not provided'}</DetailRow>
          <DetailRow label="Role">{item.contactRole || 'Not provided'}</DetailRow>
          <DetailRow label="Website">{website ? <a href={website} target="_blank" rel="noreferrer" style={{ color: T.tealInk }}>{new URL(website).hostname} ↗</a> : 'Not provided'}</DetailRow>
          <DetailRow label="Product status">{item.productStatus || 'Not provided'}</DetailRow>

          <Section>Campaign qualification</Section>
          <DetailRow label="Collaboration">{item.collaboration || 'Not provided'}</DetailRow>
          <DetailRow label="Budget">{item.budget || 'Not provided'}</DetailRow>
          <DetailRow label="Objective">{item.objective || 'Not provided'}</DetailRow>
          <DetailRow label="Timeline">{item.timeline || 'Not provided'}</DetailRow>
          <DetailRow label="Markets">{item.targetMarkets || 'Not provided'}</DetailRow>
          <DetailRow label="Deliverables"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{item.deliverables.length ? item.deliverables.map((value) => <Badge key={value} fg={T.tealInk} bg={T.tintTeal}>{value}</Badge>) : 'Not provided'}</div></DetailRow>

          <Section>Campaign brief</Section>
          <div style={{ padding: 15, border: `1px solid ${T.hairline}`, borderRadius: 13, background: T.paper, color: T.body, fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{item.message}</div>

          <Section>Submission</Section>
          <DetailRow label="Received">{dateTime(item.createdAt)}</DetailRow>
          <DetailRow label="Consent">{item.consentedAt ? `Recorded ${dateTime(item.consentedAt)}` : 'Legacy submission'}</DetailRow>
          <DetailRow label="Location"><Country m={item.meta} /></DetailRow>
          <DetailRow label="Timezone">{item.meta.timezone || 'Unknown'}</DetailRow>
          <DetailRow label="Referrer">{item.meta.referrer || 'Direct'}</DetailRow>
        </div>
      </motion.aside>
    </>
  )
}

export default function PageContacts() {
  const { slug = '' } = useParams()
  const isMobile = useIsMobile()
  const [page, setPage] = useState<ManagedPage | null>(null)
  const [contacts, setContacts] = useState<PageContact[]>([])
  const [selected, setSelected] = useState<PageContact | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ContactStatus>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pages = await api.listManagedPages()
      const match = pages.find((item) => item.slug === slug)
      if (!match) throw new Error('This managed page was not found or you do not have access.')
      const rows = await api.listPageContacts(match.id)
      setPage(match)
      setContacts(rows)
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? null : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load page contacts.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!page || !supabase) return
    const channel = supabase
      .channel(`page-contacts-${page.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'page_contacts', filter: `page_id=eq.${page.id}` }, () => void load())
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [page?.id, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((item) => {
      const statusMatch = status === 'all' || item.status === status
      const textMatch = !q || `${item.name} ${item.company} ${item.email} ${item.collaboration} ${item.budget} ${item.objective} ${item.targetMarkets}`.toLowerCase().includes(q)
      return statusMatch && textMatch
    })
  }, [contacts, search, status])

  async function open(item: PageContact) {
    setSelected(item)
    if (page?.accessLevel === 'manager' && item.status === 'new') {
      try {
        await api.setPageContactStatus(item.id, 'read')
        setContacts((rows) => rows.map((row) => row.id === item.id ? { ...row, status: 'read' } : row))
        setSelected({ ...item, status: 'read' })
      } catch {
        // Opening the contact must still work if a status update is interrupted.
      }
    }
  }

  async function updateSelected(nextStatus: ContactStatus) {
    if (!selected) return
    await api.setPageContactStatus(selected.id, nextStatus)
    setContacts((rows) => rows.map((row) => row.id === selected.id ? { ...row, status: nextStatus } : row))
    setSelected((current) => current ? { ...current, status: nextStatus } : current)
  }

  const filterBar = page ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <Link to="/pages" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.muted, fontSize: 12.5, fontWeight: 750 }}><span>←</span> All pages</Link>
      <span style={{ color: T.hairline }}>|</span>
      {(['all', ...STATUSES] as const).map((value) => <button key={value} onClick={() => setStatus(value)} style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${status === value ? T.tealInk : T.hairline}`, background: status === value ? T.tintTeal : T.surface, color: status === value ? T.tealInk : T.muted, fontSize: 11.5, fontWeight: 750, cursor: 'pointer', textTransform: 'capitalize' }}>{value}</button>)}
    </div>
  ) : null

  return (
    <>
      <PageHeader title={page ? `${page.name} contacts` : 'Page contacts'} description={page ? `Partnership inquiries received from ${page.domain}` : 'Loading managed page'} />
      {filterBar}
      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? <SkeletonRows rows={5} /> : isMobile ? (
        <ListShell search={search} setSearch={setSearch} count={filtered.length} emptyLabel={contacts.length === 0 ? 'New Today Film Makers inquiries will appear here automatically.' : 'No contacts match the current filters.'}>
          {filtered.map((item) => <MobileCard key={item.id} onClick={() => void open(item)} isNew={item.status === 'new'} name={item.name} avatarName={item.name} sub={`${item.company || 'No company'} · ${item.collaboration || 'Campaign inquiry'}`} status={item.status} meta={item.meta} />)}
        </ListShell>
      ) : (
        <TableCard search={search} setSearch={setSearch} count={filtered.length} emptyLabel={contacts.length === 0 ? 'New Today Film Makers inquiries will appear here automatically.' : 'No contacts match the current filters.'}
          head={['Contact', 'Company', 'Collaboration', 'Budget', 'Objective', 'When', 'Status'].map((heading) => <th key={heading} style={th}>{heading}</th>)}>
          {filtered.map((item) => (
            <Row key={item.id} onClick={() => void open(item)} isNew={item.status === 'new'}>
              <td style={cell}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={item.name} size={35} /><div><div style={{ color: T.ink, fontWeight: 750 }}>{item.name}</div><div style={{ color: T.muted, fontSize: 11.5 }}>{item.email}</div></div></div></td>
              <td style={cell}>{item.company || '—'}</td>
              <td style={cell}>{item.collaboration || '—'}</td>
              <td style={cell}>{item.budget || '—'}</td>
              <td style={cell}>{item.objective || '—'}</td>
              <td style={cell}>{relative(item.createdAt)}</td>
              <td style={cell}><StatusBadge s={item.status} /></td>
            </Row>
          ))}
        </TableCard>
      )}

      <AnimatePresence>
        {page && selected && <PageContactDrawer key={selected.id} page={page} item={selected} onClose={() => setSelected(null)} onStatus={updateSelected} />}
      </AnimatePresence>
    </>
  )
}
