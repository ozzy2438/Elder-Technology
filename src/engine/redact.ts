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

const NAME_TOKEN = /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g

export function stripNamesFromText(text: string): string {
  return text.replace(NAME_TOKEN, '[name-redacted]')
}

export function redactExtract(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([key]) => !isNameHeader(key) && !key.endsWith('_name'))
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}
