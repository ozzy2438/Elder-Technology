import Papa from 'papaparse'
import { maxIso, minIso, parseDate, parseTemporal, parseMinutes } from './dates.ts'
import { mapHeaders, requiredForClass, scoreClass, type ColumnMaps } from './columns.ts'
import { isNameHeader, normaliseHeader } from './redact.ts'
import type { CanonicalRow, OpenQuestion, ParsedTable, SourceClass } from './types.ts'

export interface MappingOverride {
  source_class: SourceClass
  mapped_fields?: Record<string, string>
}
export type MappingOverrides = Record<string, MappingOverride>

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso
  }
  return String(value).trim()
}

function tableFromMatrix(
  source_file: string,
  matrix: string[][],
  maps: ColumnMaps,
  override?: MappingOverride,
): ParsedTable {
  const headers = (matrix[0] ?? []).map((h) => h.trim())
  if (new Set(headers.map(normaliseHeader)).size !== headers.length) {
    throw new Error(`${source_file}: duplicate column names. Rename them before importing.`)
  }
  const scored = scoreClass(headers, maps)
  const source_class =
    override?.source_class ?? (scored.confidence >= 0.45 ? scored.source_class : 'unknown')
  const required = requiredForClass(source_class, maps)
  const all = mapHeaders(headers, maps.synonyms).mapping
  // Prefer the fields belonging to this table when aliases overlap (e.g. plan_id).
  const mapping: Record<string, string> = override?.mapped_fields
    ? { ...override.mapped_fields }
    : {}
  if (!override?.mapped_fields) {
    const used = new Set<string>()
    for (const field of [...required, ...Object.keys(all)]) {
      let original = all[field]
      if (!original && field === 'claim_date') original = all.date
      if (!original && field === 'service_date') original = all.date
      if (original && !used.has(original)) {
        mapping[field] = original
        used.add(original)
      }
    }
  }
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) {
      delete mapping[field]
      continue
    }
    if (!headers.includes(header) || isNameHeader(header) || !maps.synonyms[field]) {
      throw new Error(`${source_file}: invalid mapping for ${field}.`)
    }
  }
  if (new Set(Object.values(mapping)).size !== Object.values(mapping).length) {
    throw new Error(`${source_file}: a column cannot supply two different fields.`)
  }
  const unmapped_required = required.filter((field) => !mapping[field])
  const name_fields_stripped = headers.filter(isNameHeader)
  const name_values: string[] = []
  const issues: string[] = []
  const rows: CanonicalRow[] = []
  const dates: Array<string | null> = []
  const nullCounts: Record<string, number> = Object.fromEntries(
    Object.keys(mapping).map((f) => [f, 0]),
  )

  matrix.slice(1).forEach((line, index) => {
    if (line.every((c) => !c)) return
    if (line.length > headers.length)
      throw new Error(`${source_file}: row ${index + 2} has more cells than columns.`)
    const values: Record<string, string> = {}
    const locator = `${source_file}:row:${index + 2}`
    headers.forEach((header, col) => {
      const raw = cellToString(line[col])
      if (isNameHeader(header)) {
        if (raw) name_values.push(raw)
        return
      }
      const canonical = Object.entries(mapping).find(([, original]) => original === header)?.[0]
      if (!canonical) return // Import only mapped fields; free-text notes stay out of the report.
      if (!raw) nullCounts[canonical] += 1
      if (/date|_at$|valid_|review_due/.test(canonical)) {
        const temporal = parseTemporal(raw)
        values[canonical] = temporal ?? raw
        dates.push(parseDate(raw))
        if (raw && !temporal)
          issues.push(`Row ${index + 2}: ${canonical} is not a valid date/time.`)
      } else if (canonical === 'duration_minutes') {
        const minutes = parseMinutes(raw, header)
        values[canonical] = minutes == null ? raw : String(minutes)
        if (raw && minutes == null)
          issues.push(`Row ${index + 2}: duration must be a non-negative number.`)
      } else {
        values[canonical] = raw
      }
    })
    rows.push({ source_file, locator, values })
  })
  const null_rates = Object.fromEntries(
    Object.entries(nullCounts).map(([f, n]) => [f, rows.length ? n / rows.length : 0]),
  )
  const open_questions: OpenQuestion[] = []
  if (source_class === 'unknown')
    open_questions.push({
      id: `map-${source_file}`,
      question: `Confirm the source type and field mapping for ${source_file}; it is excluded until identified.`,
      related_claim_id: '',
    })
  if (unmapped_required.length)
    open_questions.push({
      id: `fields-${source_file}`,
      question: `${source_file}: provide columns for ${unmapped_required.join(', ')}. Missing fields remain evidence gaps.`,
      related_claim_id: '',
    })
  if (issues.length)
    open_questions.push({
      id: `quality-${source_file}`,
      question: `${source_file}: correct ${issues.length} invalid date/time or duration cells listed in intake.`,
      related_claim_id: '',
    })
  return {
    headers: headers.filter((h) => !isNameHeader(h)),
    issues,
    source_file,
    source_class,
    mapping_confidence: override ? 1 : scored.confidence,
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

export async function parseSourceFile(
  file: File,
  maps: ColumnMaps,
  overrides: MappingOverrides = {},
): Promise<ParsedTable[]> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv')) {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' })
    if (parsed.errors.length) throw new Error(`${file.name}: ${parsed.errors[0].message}`)
    return [
      tableFromMatrix(
        file.name,
        parsed.data.map((r) => r.map(cellToString)),
        maps,
        overrides[file.name],
      ),
    ]
  }
  if (lower.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file/universal')
    const sheets = await readXlsxFile(await file.arrayBuffer())
    return sheets
      .filter((s) => s.data.length)
      .map((sheet) => {
        const key = `${file.name} [${sheet.sheet}]`
        return tableFromMatrix(
          key,
          sheet.data.map((r) => r.map(cellToString)),
          maps,
          overrides[key],
        )
      })
  }
  throw new Error(`${file.name}: use CSV or XLSX. Save legacy XLS files as XLSX first.`)
}

export async function parseFile(file: File, maps: ColumnMaps): Promise<ParsedTable> {
  const tables = await parseSourceFile(file, maps)
  if (tables.length !== 1)
    throw new Error(`${file.name}: use parseSourceFile for multi-sheet workbooks.`)
  return tables[0]
}
