const NAME_HEADER =
  /^(participant_name|client_name|consumer_name|service_user_name|person_name|worker_name|staff_name|carer_name|care_worker_name|full_name|first_name|last_name|surname|given_name|name)$/i

export function isNameHeader(header: string): boolean {
  return NAME_HEADER.test(normaliseHeader(header))
}

export function normaliseHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-/]+/g, '_')
}

export function redactKnownNames(text: string, names: string[]): string {
  let out = text
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 2))]
  unique.sort((a, b) => b.length - a.length)
  for (const name of unique) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(escaped, 'gi'), '[name-redacted]')
  }
  return out
}

/** Redact decoded strings, including names containing JSON quotes/escapes. */
export function redactObject<T>(value: T, names: string[]): T {
  if (typeof value === 'string') return redactKnownNames(value, names) as T
  if (Array.isArray(value)) return value.map((item) => redactObject(item, names)) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactObject(item, names)]),
    ) as T
  return value
}

export function redactExtract(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([key]) => !isNameHeader(key) && !key.endsWith('_name'))
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}
