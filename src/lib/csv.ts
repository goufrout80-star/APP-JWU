/* Minimal client-side CSV export — no data leaves the browser, just
   turns already-fetched rows into a downloadable file. */
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
