import { sanitisePosition } from './guards.ts'
import { groupTables, toIntakeFile, unassessableFor } from './intake.ts'
import { claimById } from './pack.ts'
import { parseSourceFile, type MappingOverrides } from './parse.ts'
import { parseDate } from './dates.ts'
import { sortFindings, uniqueQuestions } from './report.ts'
import { redactObject } from './redact.ts'
import type { CrossCheckSummary, EngineContext, EvidencePosition, ParsedTable } from './types.ts'
import { resolvePack } from '../jurisdictions/registry.ts'

export interface RunInput {
  provider_ref: string
  period_from: string
  period_to: string
  files: File[]
  generated_at?: string
  pack_id?: string
  mappings?: MappingOverrides
}
export interface PreparedIntake {
  pack_id: string
  tables: ParsedTable[]
}

function validateInput(input: RunInput) {
  if (!input.provider_ref.trim())
    throw new Error('Enter a provider reference (use an identifier, not a name).')
  if (
    parseDate(input.period_from) !== input.period_from ||
    parseDate(input.period_to) !== input.period_to
  ) {
    throw new Error('Enter valid start and end dates.')
  }
  if (input.period_from > input.period_to)
    throw new Error('The end date must be on or after the start date.')
  if (!input.files.length) throw new Error('Add at least one CSV or XLSX export.')
  if (new Set(input.files.map((f) => f.name)).size !== input.files.length)
    throw new Error('File names must be unique within this review.')
}

/** Intake is explicit and reviewable before any cross-check runs. */
export async function prepareIntake(input: RunInput): Promise<PreparedIntake> {
  validateInput(input)
  const pack = resolvePack(input.pack_id)
  const tables: ParsedTable[] = []
  for (const file of input.files)
    tables.push(...(await parseSourceFile(file, pack.columns, input.mappings)))
  if (!tables.length) throw new Error('The supplied exports contain no tables.')
  // Collect names first, then redact identifier fields across every table too.
  const names = tables.flatMap((t) => t.name_values)
  for (const table of tables) {
    table.rows = redactObject(table.rows, names)
  }
  return { pack_id: pack.id, tables }
}

export function analysePrepared(input: RunInput, prepared: PreparedIntake): EvidencePosition {
  validateInput(input)
  const pack = resolvePack(input.pack_id)
  if (prepared.pack_id !== pack.id)
    throw new Error('Review the intake again after changing jurisdiction.')
  const tables = prepared.tables
  const grouped = groupTables(tables)
  const open_questions = [
    ...tables.flatMap((t) => t.open_questions),
    ...pack.packQuestions.map((q) =>
      q.id === 'corpus-id'
        ? {
            ...q,
            question: `Loaded corpus ${pack.corpus.corpus_id}, retrieved ${pack.corpus.retrieved_at}. Verify applicability before relying on regulatory context.`,
          }
        : q,
    ),
  ]
  const ctx: EngineContext = {
    provider_ref: input.provider_ref.trim(),
    period: { from: input.period_from, to: input.period_to },
    generated_at: input.generated_at ?? new Date().toISOString(),
    tables: grouped,
    intake_files: tables.map(toIntakeFile),
    open_questions,
    pack_id: pack.id,
    corpus_id: pack.corpus.corpus_id,
    claimById: (id) => claimById(pack, id),
  }
  const findings = pack.runChecks(ctx)
  const byCheck = new Map<string, string[]>()
  for (const claim of pack.claims)
    byCheck.set(claim.cross_check, [...(byCheck.get(claim.cross_check) ?? []), claim.id])
  const cross_checks: CrossCheckSummary[] = [...byCheck.entries()].map(([id, finding_ids]) => ({
    id,
    finding_ids,
    note: findings
      .filter((f) => finding_ids.includes(f.id))
      .map((f) => `${f.id}=${f.grade}`)
      .join('; '),
  }))
  return sanitisePosition(
    {
      run: {
        provider_ref: ctx.provider_ref,
        period: ctx.period,
        sources: input.files.map((f) => f.name),
        generated_at: ctx.generated_at,
        pack_id: pack.id,
        corpus_id: pack.corpus.corpus_id,
      },
      intake: {
        files: ctx.intake_files,
        unassessable_requirements: unassessableFor(grouped, pack.claims),
      },
      findings: sortFindings(findings, pack.claimWeights),
      cross_checks,
      open_questions: uniqueQuestions(ctx.open_questions),
    },
    tables.flatMap((t) => t.name_values),
    pack.extraForbidden,
  )
}

export async function runAnalysis(input: RunInput): Promise<EvidencePosition> {
  return analysePrepared(input, await prepareIntake(input))
}
