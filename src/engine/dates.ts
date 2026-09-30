const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const AU = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
const STAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/

function validDay(value: string): boolean {
  if (!DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Preserve source precision and offsets. Never invent an unspecified time zone. */
export function parseTemporal(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (validDay(value)) return value
  const au = AU.exec(value)
  if (au) {
    const day = `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}`
    return validDay(day) ? day : null
  }
  const stamp = STAMP.exec(value)
  if (!stamp || !validDay(stamp[1])) return null
  if (+stamp[2] > 23 || +stamp[3] > 59 || +(stamp[4] ?? '0') > 59) return null
  if (stamp[6] && !Number.isFinite(Date.parse(value.replace(' ', 'T')))) return null
  return value.replace(' ', 'T')
}

export function parseDate(raw: string | null | undefined): string | null {
  return parseTemporal(raw)?.slice(0, 10) ?? null
}

/** null means the supplied precision/time-zone information cannot establish order. */
export function compareTemporal(a: string, b: string): number | null {
  const left = parseTemporal(a)
  const right = parseTemporal(b)
  if (!left || !right) return null
  const leftStamp = left.length > 10
  const rightStamp = right.length > 10
  if (!leftStamp && !rightStamp) return left.localeCompare(right)
  if (leftStamp !== rightStamp) {
    const days = left.slice(0, 10).localeCompare(right.slice(0, 10))
    return days === 0 ? null : days
  }
  const zoned = (v: string) => /Z$|[+-]\d{2}:\d{2}$/.test(v)
  if (zoned(left) !== zoned(right)) return null
  const time = (v: string) => Date.parse(zoned(v) ? v : `${v}Z`)
  return Math.sign(time(left) - time(right))
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b)
}

export function inPeriod(iso: string | null, from: string, to: string): boolean {
  const day = parseDate(iso)
  return Boolean(day && day >= from && day <= to)
}

export function minIso(dates: Array<string | null>): string | null {
  return dates.filter((d): d is string => Boolean(d)).sort()[0] ?? null
}

export function maxIso(dates: Array<string | null>): string | null {
  return (
    dates
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null
  )
}

export function parseMinutes(raw: string, headerHint: string): number | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const n = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return /hour/i.test(headerHint) ? n * 60 : n
}

export function truthy(raw: string): boolean {
  return /^(true|yes|y|1)$/i.test(raw.trim())
}
