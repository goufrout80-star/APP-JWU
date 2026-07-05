import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { T, SHADOW } from '../lib/theme'
import type { AppSettings } from '../lib/types'
import { PageHeader, Button, RoleBadge, ErrorBanner, SkeletonRows, useToast } from '../components/ui'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 11, border: `1px solid ${T.hairline}`, fontSize: 13.5, outline: 'none', color: T.ink, background: T.surface }

export default function Settings() {
  const { user, isSuperAdmin } = useAuth()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  function load() {
    setLoading(true); setError(null)
    api.getSettings().then(setSettings).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings.')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      await Promise.all([
        api.setSetting('orgName', settings.orgName),
        api.setSetting('notifyEmail', settings.notifyEmail),
        api.setSetting('defaultPageSize', settings.defaultPageSize),
      ])
      show('Settings saved.')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to save settings.', true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile and basic app configuration" />
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Your account</div>
        <Field label="Email"><div style={{ fontSize: 13.5, color: T.ink }}>{user?.email}</div></Field>
        <Field label="Role"><RoleBadge role={user?.role ?? 'admin'} /></Field>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 20, boxShadow: SHADOW.soft, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 14 }}>
          App configuration {!isSuperAdmin && <span style={{ fontWeight: 500, color: T.muted, fontSize: 12 }}>(read-only — Super Admin only)</span>}
        </div>
        {loading || !settings ? <SkeletonRows rows={3} /> : (
          <>
            <Field label="Organization name">
              <input style={inputStyle} value={settings.orgName} disabled={!isSuperAdmin}
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })} />
            </Field>
            <Field label="Notification email" hint="Where important alerts would be sent (not yet wired to an email provider).">
              <input style={inputStyle} type="email" value={settings.notifyEmail} disabled={!isSuperAdmin}
                onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.value })} />
            </Field>
            <Field label="Default page size" hint="How many rows to show per page in tables (applies on next reload).">
              <input style={{ ...inputStyle, width: 120 }} type="number" min={5} max={100} value={settings.defaultPageSize} disabled={!isSuperAdmin}
                onChange={(e) => setSettings({ ...settings, defaultPageSize: Number(e.target.value) || 25 })} />
            </Field>
            {isSuperAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
