/* Small presentational helpers for the dashboard. */

/** "DE" → 🇩🇪  (regional-indicator flag from an ISO alpha-2 code). */
export function flag(code: string | null): string {
  if (!code || code.length !== 2) return '🏳️'
  const A = 0x1f1e6
  const cc = code.toUpperCase()
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65)
}

/** 0 → "0s", 95 → "1m 35s", 3725 → "1h 2m". */
export function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** ISO → "Jun 26, 2:14 PM". */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** ISO → "2h ago", "3d ago". */
export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
