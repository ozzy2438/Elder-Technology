const NAME_HEADER =
  /^(participant_name|client_name|consumer_name|worker_name|staff_name|carer_name|full_name|first_name|last_name|surname|given_name|name)$/i

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
    out = out.split(name).join('[name-redacted]')
  }
  return out
}

export function redactExtract(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([key]) => !isNameHeader(key) && !key.endsWith('_name'))
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}
