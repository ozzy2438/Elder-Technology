const ISO = /^(\d{4})-(\d{2})-(\d{2})/
const AU = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null
  const iso = ISO.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const au = AU.exec(value)
  if (au) {
    const day = au[1].padStart(2, '0')
    const month = au[2].padStart(2, '0')
    return `${au[3]}-${month}-${day}`
  }
  const dt = new Date(value)
  if (!Number.isNaN(dt.getTime()) && value.length >= 8) {
    return dt.toISOString().slice(0, 10)
  }
  return null
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b)
}

export function inPeriod(iso: string | null, from: string, to: string): boolean {
  if (!iso) return false
  return iso >= from && iso <= to
}

export function minIso(dates: Array<string | null>): string | null {
  const present = dates.filter((d): d is string => Boolean(d)).sort()
  return present[0] ?? null
}

export function maxIso(dates: Array<string | null>): string | null {
  const present = dates.filter((d): d is string => Boolean(d)).sort()
  return present[present.length - 1] ?? null
}

export function parseMinutes(raw: string, headerHint: string): number | null {
  if (!raw || !String(raw).trim()) return null
  const n = Number(String(raw).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return null
  if (/hour/i.test(headerHint)) return Math.round(n * 60)
  return Math.round(n)
}

export function truthy(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return v === 'true' || v === 'yes' || v === 'y' || v === '1'
}
