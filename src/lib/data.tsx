/* ════════════════════════════════════════════════════════════════
   Central data store — contacts + applications are fetched once here
   and shared across Overview/Contacts/Applications/Analytics, instead
   of each page re-fetching independently.
   ════════════════════════════════════════════════════════════════ */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Application, ContactSubmission, ContactStatus, ApplicationStatus, Submission } from './types'

interface DataState {
  contacts: ContactSubmission[]
  apps: Application[]
  loading: boolean
  error: string | null
  reload: () => void
  changeStatus: (item: Submission, status: string) => Promise<void>
}

const DataCtx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<ContactSubmission[]>([])
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([api.listContacts(), api.listApplications()])
      .then(([c, a]) => { setContacts(c); setApps(a) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(reload, [reload])

  const changeStatus = useCallback(async (item: Submission, status: string) => {
    if (item.kind === 'contact') {
      await api.setContactStatus(item.id, status as ContactStatus)
      setContacts((cs) => cs.map((c) => (c.id === item.id ? { ...c, status: status as ContactStatus } : c)))
    } else {
      await api.setApplicationStatus(item.id, status as ApplicationStatus)
      setApps((as) => as.map((a) => (a.id === item.id ? { ...a, status: status as ApplicationStatus } : a)))
    }
  }, [])

  return (
    <DataCtx.Provider value={{ contacts, apps, loading, error, reload, changeStatus }}>
      {children}
    </DataCtx.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
