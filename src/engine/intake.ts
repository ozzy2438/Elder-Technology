import type {
  CorpusClaim,
  EngineContext,
  IntakeFileReport,
  ParsedTable,
  SourceClass,
  UnassessableRequirement,
} from './types.ts'
import { inPeriod, parseDate } from './dates.ts'

export function toIntakeFile(table: ParsedTable): IntakeFileReport {
  return {
    source_file: table.source_file,
    source_class: table.source_class,
    mapping_confidence: table.mapping_confidence,
    row_count: table.rows.length,
    date_min: table.date_min,
    date_max: table.date_max,
    null_rates: table.null_rates,
    mapped_fields: table.mapped_fields,
    unmapped_required: table.unmapped_required,
    name_fields_stripped: table.name_fields_stripped,
    issues: table.issues,
  }
}

export function groupTables(tables: ParsedTable[]): Record<SourceClass, ParsedTable[]> {
  const grouped = {
    service_delivery: [],
    billing: [],
    participant_register: [],
    care_plans: [],
    consent: [],
    incidents: [],
    workers: [],
    competency: [],
    roster: [],
    policies: [],
    unknown: [],
  } as Record<SourceClass, ParsedTable[]>
  for (const table of tables) grouped[table.source_class].push(table)
  return grouped
}

export function unassessableFor(
  tables: Record<SourceClass, ParsedTable[]>,
  claims: CorpusClaim[],
): UnassessableRequirement[] {
  const present = new Set(
    (Object.entries(tables) as Array<[SourceClass, ParsedTable[]]>)
      .filter(([, list]) => list.some((t) => t.rows.length > 0))
      .map(([cls]) => cls),
  )
  const out: UnassessableRequirement[] = []
  for (const claim of claims) {
    const missing = claim.evidence_requirement.artefact_types.filter(
      (cls) => cls !== 'unknown' && !present.has(cls),
    )
    if (missing.length === 0) continue
    if (claim.corpus_status === 'uncovered') continue
    out.push({
      claim_id: claim.id,
      reason: `Source class not supplied: ${missing.join(', ')}`,
      missing_source_classes: missing,
    })
  }
  return out
}

export function rowsOf(ctx: EngineContext, cls: SourceClass) {
  return ctx.tables[cls].flatMap((t) => t.rows)
}

export function hasClass(ctx: EngineContext, cls: SourceClass): boolean {
  return rowsOf(ctx, cls).length > 0
}

/** Keep undated/invalid events visible as gaps instead of silently discarding them. */
export function periodRows(ctx: EngineContext, cls: SourceClass, field: string) {
  return rowsOf(ctx, cls).filter((row) => {
    const day = parseDate(row.values[field])
    return !day || inPeriod(day, ctx.period.from, ctx.period.to)
  })
}
