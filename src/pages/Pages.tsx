import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { T, SHADOW } from '../lib/theme'
import type { ManagedPage } from '../lib/types'
import { PageHeader, Badge, ErrorBanner, SkeletonRows, Icon, IC } from '../components/ui'

interface PageSummary { page: ManagedPage; total: number; unread: number }

export default function Pages() {
  const [summaries, setSummaries] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pages = await api.listManagedPages()
      const contacts = await Promise.all(pages.map((page) => api.listPageContacts(page.id)))
      setSummaries(pages.map((page, index) => ({
        page,
        total: contacts[index].length,
        unread: contacts[index].filter((item) => item.status === 'new').length,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load managed pages.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('managed-pages-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'page_contacts' }, () => void load())
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [load])

  return (
    <>
      <PageHeader title="Pages" description="Manage contacts and future operations for JWU-owned and represented media pages" />
      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? <SkeletonRows rows={3} /> : summaries.length === 0 ? (
        <div style={{ padding: 36, border: `1px solid ${T.hairline}`, borderRadius: 18, background: T.surface, color: T.muted }}>
          You do not currently have access to a managed page.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(285px,1fr))', gap: 18 }}>
          {summaries.map(({ page, total, unread }) => (
            <article key={page.id} style={{ position: 'relative', overflow: 'hidden', background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 22, boxShadow: SHADOW.soft, padding: 22 }}>
              <div style={{ position: 'absolute', inset: '0 0 auto', height: 4, background: page.accentColor || T.tealDeep }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ width: 50, height: 50, borderRadius: 15, display: 'grid', placeItems: 'center', background: T.paper, border: `1px solid ${T.hairline}` }}>
                  <Icon d={IC.globe} size={23} color={T.ink} />
                </div>
                <Badge fg={page.accessLevel === 'manager' ? T.tealInk : T.muted} bg={page.accessLevel === 'manager' ? T.tintTeal : T.paper}>{page.accessLevel === 'manager' ? 'Manager' : 'Viewer'}</Badge>
              </div>
              <h2 style={{ margin: '20px 0 5px', fontSize: 22, letterSpacing: '-0.025em', color: T.ink }}>{page.name}</h2>
              <a href={`https://${page.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: T.tealInk, fontWeight: 700 }}>{page.domain} ↗</a>
              <p style={{ minHeight: 44, margin: '14px 0 20px', color: T.muted, fontSize: 13, lineHeight: 1.55 }}>{page.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
                <div style={{ padding: 13, borderRadius: 13, background: T.paper, border: `1px solid ${T.hairline}` }}><div style={{ color: T.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Contacts</div><strong style={{ display: 'block', marginTop: 5, fontSize: 22, color: T.ink }}>{total}</strong></div>
                <div style={{ padding: 13, borderRadius: 13, background: unread ? T.tintCoral : T.paper, border: `1px solid ${unread ? `${T.coral}44` : T.hairline}` }}><div style={{ color: unread ? T.coralInk : T.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>New</div><strong style={{ display: 'block', marginTop: 5, fontSize: 22, color: unread ? T.coralInk : T.ink }}>{unread}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
                <Badge fg={T.tealInk} bg={T.tintTeal}>Contacts active</Badge>
                <Badge fg={T.muted} bg={T.paper}>Campaigns next</Badge>
                <Badge fg={T.muted} bg={T.paper}>Analytics next</Badge>
              </div>

              <Link to={`/pages/${page.slug}/contacts`} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: T.tealDeep, color: '#fff', fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}>
                Open page workspace <Icon d={IC.out} size={16} color="#fff" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
