import Papa from 'papaparse'
import { maxIso, minIso, parseDate } from './dates.ts'
import { mapHeaders, requiredForClass, scoreClass } from './columns.ts'
import { isNameHeader, normaliseHeader } from './redact.ts'
import type { CanonicalRow, OpenQuestion, ParsedTable, SourceClass } from './types.ts'

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).trim()
}

function tableFromMatrix(
  source_file: string,
  matrix: string[][],
  sourceHint?: SourceClass,
): ParsedTable {
  if (matrix.length === 0) {
    return emptyTable(source_file, sourceHint ?? 'unknown')
  }
  const headers = matrix[0].map((h) => h.trim())
  const scored = scoreClass(headers)
  const source_class = sourceHint && sourceHint !== 'unknown' ? sourceHint : scored.source_class
  const { mapping } = mapHeaders(headers)
  if (source_class === 'billing' && mapping.date && !mapping.claim_date) {
    mapping.claim_date = mapping.date
  }
  if (source_class === 'service_delivery' && mapping.date && !mapping.service_date) {
    mapping.service_date = mapping.date
  }
  const required = requiredForClass(source_class)
  const unmapped_required = required.filter((f) => !mapping[f])
  const name_fields_stripped = headers.filter((h) => isNameHeader(h))
  const name_values: string[] = []
  const dateFields = Object.keys(mapping).filter((k) => /date|_at$|valid_|review_due/.test(k))

  const rows: CanonicalRow[] = []
  const dates: Array<string | null> = []
  const nullCounts: Record<string, number> = {}
  for (const field of Object.keys(mapping)) nullCounts[field] = 0

  matrix.slice(1).forEach((line, index) => {
    if (line.every((c) => !c)) return
    const values: Record<string, string> = {}
    headers.forEach((header, col) => {
      if (isNameHeader(header)) {
        const rawName = cellToString(line[col])
        if (rawName) name_values.push(rawName)
        return
      }
      const canonical = Object.entries(mapping).find(([, original]) => original === header)?.[0]
      const raw = cellToString(line[col])
      if (canonical) {
        const asDate = parseDate(raw)
        values[canonical] =
          asDate && /date|_at$|valid_|review_due/.test(canonical) ? asDate : raw
        if (!raw) nullCounts[canonical] += 1
      } else {
        values[`raw_${normaliseHeader(header)}`] = raw
      }
    })
    const locator = `${source_file}:row:${index + 2}`
    rows.push({ source_file, locator, values })
    for (const field of dateFields) dates.push(parseDate(values[field] ?? ''))
  })

  const null_rates: Record<string, number> = {}
  for (const [field, count] of Object.entries(nullCounts)) {
    null_rates[field] = rows.length === 0 ? 0 : Number((count / rows.length).toFixed(4))
  }

  const open_questions: OpenQuestion[] = []
  if (scored.confidence < 0.45 || source_class === 'unknown') {
    open_questions.push({
      id: `map-${source_file}`,
      question: `Which source class is ${source_file}? Headers did not map confidently.`,
      related_claim_id: '',
    })
  }
  if (unmapped_required.length > 0 && source_class !== 'unknown') {
    open_questions.push({
      id: `fields-${source_file}`,
      question: `${source_file} is treated as ${source_class} but these fields were not mapped: ${unmapped_required.join(', ')}. What are the source column names?`,
      related_claim_id: '',
    })
  }

  return {
    source_file,
    source_class,
    mapping_confidence: scored.confidence,
    mapped_fields: mapping,
    unmapped_required,
    name_fields_stripped,
    name_values,
    rows,
    date_min: minIso(dates),
    date_max: maxIso(dates),
    null_rates,
    open_questions,
  }
}

function emptyTable(source_file: string, source_class: SourceClass): ParsedTable {
  return {
    source_file,
    source_class,
    mapping_confidence: 0,
    mapped_fields: {},
    unmapped_required: requiredForClass(source_class),
    name_fields_stripped: [],
    name_values: [],
    rows: [],
    date_min: null,
    date_max: null,
    null_rates: {},
    open_questions: [],
  }
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name
  const lower = name.toLowerCase()
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
    const matrix = (parsed.data as unknown as string[][]).map((row) =>
      row.map((c) => cellToString(c)),
    )
    return tableFromMatrix(name, matrix)
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { default: readXlsxFile } = await import('read-excel-file/universal')
    const rows = (await readXlsxFile(await file.arrayBuffer())) as unknown as unknown[][]
    const matrix = rows.map((row) => row.map((c) => cellToString(c)))
    return tableFromMatrix(name, matrix)
  }
  throw new Error(`Unsupported file type: ${name}`)
}
