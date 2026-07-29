import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from './api'
import { supabase } from './supabase'
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
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([api.listContacts(), api.listApplications()])
      .then(([c, a]) => { setContacts(c); setApps(a) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data.'))
      .finally(() => setLoading(false))
  }, [])

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(reload, 180)
  }, [reload])

  useEffect(reload, [reload])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('jwu-admin-submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, scheduleReload)
      .subscribe()

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [scheduleReload])

  const changeStatus = useCallback(async (item: Submission, status: string) => {
    if (item.kind === 'contact') {
      await api.setContactStatus(item.id, status as ContactStatus)
      setContacts((cs) => cs.map((c) => (c.id === item.id ? { ...c, status: status as ContactStatus } : c)))
    } else {
      await api.setApplicationStatus(item.id, status as ApplicationStatus)
      setApps((as) => as.map((a) => (a.id === item.id ? { ...a, status: status as ApplicationStatus } : a)))
    }
  }, [])

  return <DataCtx.Provider value={{ contacts, apps, loading, error, reload, changeStatus }}>{children}</DataCtx.Provider>
}

export function useData() {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
