import { useEffect } from 'react'
import { useAuth } from './auth'

const START_KEY = 'jwu-admin-session-start'
const ACTIVE_KEY = 'jwu-admin-session-active'
const ABSOLUTE_MS = 8 * 60 * 60 * 1000
const IDLE_MS = 30 * 60 * 1000

export function useSessionTimeout() {
  const { user, signOut } = useAuth()

  useEffect(() => {
    if (!user) return
    const now = Date.now()
    if (!Number(sessionStorage.getItem(START_KEY))) sessionStorage.setItem(START_KEY, String(now))
    if (!Number(sessionStorage.getItem(ACTIVE_KEY))) sessionStorage.setItem(ACTIVE_KEY, String(now))

    let lastWrite = 0
    const markActive = () => {
      const current = Date.now()
      if (current - lastWrite < 30_000) return
      lastWrite = current
      sessionStorage.setItem(ACTIVE_KEY, String(current))
    }

    const expire = () => {
      sessionStorage.removeItem(START_KEY)
      sessionStorage.removeItem(ACTIVE_KEY)
      signOut()
      window.location.replace('/login?reason=session-expired')
    }

    const check = () => {
      const current = Date.now()
      const started = Number(sessionStorage.getItem(START_KEY) || current)
      const active = Number(sessionStorage.getItem(ACTIVE_KEY) || current)
      if (current - started >= ABSOLUTE_MS || current - active >= IDLE_MS) expire()
    }

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }))
    const timer = window.setInterval(check, 15_000)
    check()

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive))
      window.clearInterval(timer)
    }
  }, [signOut, user])
}
