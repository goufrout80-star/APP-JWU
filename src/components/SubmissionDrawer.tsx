import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { T, SHADOW } from '../lib/theme'
import { flag, dateTime, duration, relative } from '../lib/format'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Submission, SubmissionNote } from '../lib/types'
import { Icon, IC, Avatar, StatusSelect, Button, ConfirmDialog, useToast } from './ui'

const CONTACT_STATUSES = ['new', 'read', 'replied', 'archived']
const APP_STATUSES = ['new', 'reviewing', 'accepted', 'rejected']

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

function NotesSection({ submissionType, submissionId }: { submissionType: 'contact' | 'application'; submissionId: string }) {
  const [notes, setNotes] = useState<SubmissionNote[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api.listNotes(submissionType, submissionId).then(setNotes).catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load notes.')).finally(() => setLoading(false))
  }
  useEffect(load, [submissionType, submissionId])

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSaving(true); setErr(null)
    try {
      await api.addNote(submissionType, submissionId, trimmed)
      setBody('')
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add note.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteNote(id)
      setNotes((ns) => ns.filter((n) => n.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete note.')
    }
  }

  return (
    <>
      <SectionLabel>Internal notes</SectionLabel>
      {err && <div style={{ fontSize: 12.5, color: T.coralInk, marginTop: 6 }}>{err}</div>}
      {loading ? (
        <div style={{ fontSize: 12.5, color: T.muted, padding: '10px 0' }}>Loading notes…</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.muted, padding: '10px 0' }}>No notes yet. Leave one for the team below.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: T.tealInk }}>{n.authorEmail.split('@')[0]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{relative(n.createdAt)}</span>
                  <button onClick={() => remove(n.id)} title="Delete note" style={{ border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                    <Icon d={IC.trash} size={13} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note for the team…" rows={2}
          style={{ flex: 1, resize: 'vertical', border: `1px solid ${T.hairline}`, borderRadius: 11, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: T.ink }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="primary" size="sm" onClick={submit} disabled={saving || !body.trim()}>{saving ? 'Saving…' : 'Add note'}</Button>
      </div>
    </>
  )
}

interface SubmissionDrawerProps {
  item: Submission
  onClose: () => void
  onStatus: (s: string) => void
  onDelete: () => Promise<void>
}

export function SubmissionDrawer({ item, onClose, onStatus, onDelete }: SubmissionDrawerProps) {
  const { isSuperAdmin } = useAuth()
  const { show } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)
  const m = item.meta
  const title = item.kind === 'contact' ? item.name : item.kind === 'application' && item.appType === 'creator' ? item.name : item.company
  const email = item.email
  const accent = item.kind === 'contact' ? T.tealInk : T.coralInk
  const itemLabel = item.kind === 'contact' ? 'contact' : 'application'

  async function removeSubmission() {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      await onDelete()
      show(`${itemLabel === 'contact' ? 'Contact' : 'Application'} deleted.`)
      setConfirmDelete(false)
      onClose()
    } catch (e) {
      show(e instanceof Error ? e.message : `Failed to delete ${itemLabel}.`, true)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,0.32)', zIndex: 40 }} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 94vw)', background: T.surface, boxShadow: SHADOW.lift, zIndex: 50, overflowY: 'auto' }}>
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
          <SectionLabel>Status</SectionLabel>
          <div style={{ marginTop: 8 }}>
            <StatusSelect value={item.status} options={item.kind === 'contact' ? CONTACT_STATUSES : APP_STATUSES} onChange={onStatus} />
          </div>

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

          <NotesSection submissionType={itemLabel} submissionId={item.id} />

          {isSuperAdmin && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.hairline}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.coralInk, marginBottom: 8 }}>Danger zone</div>
              <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, margin: '0 0 12px' }}>Permanently remove this {itemLabel} and all of its internal notes.</p>
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
                <Icon d={IC.trash} size={15} color="#fff" />{deleting ? 'Deleting…' : `Delete ${itemLabel}`}
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${itemLabel}?`}
        danger
        body={<>This permanently deletes <b>{title}</b>, the submitted data, and all related internal notes. The action is recorded in the Activity Log and cannot be undone.</>}
        confirmLabel={deleting ? 'Deleting…' : `Delete ${itemLabel}`}
        onCancel={() => { if (!deleting) setConfirmDelete(false) }}
        onConfirm={removeSubmission}
      />
    </>
  )
}
