import { sanitisePosition } from './guards.ts'
import { groupTables, toIntakeFile, unassessableFor } from './intake.ts'
import { claimById } from './pack.ts'
import { parseFile } from './parse.ts'
import { sortFindings, uniqueQuestions } from './report.ts'
import type { CrossCheckSummary, EngineContext, EvidencePosition, OpenQuestion } from './types.ts'
import { resolvePack } from '../jurisdictions/registry.ts'

export interface RunInput {
  provider_ref: string
  period_from: string
  period_to: string
  files: File[]
  generated_at?: string
  pack_id?: string
}

export async function runAnalysis(input: RunInput): Promise<EvidencePosition> {
  const pack = resolvePack(input.pack_id)
  const tables = []
  for (const file of input.files) {
    tables.push(await parseFile(file, pack.columns))
  }
  const grouped = groupTables(tables)
  const open_questions: OpenQuestion[] = [
    ...tables.flatMap((t) => t.open_questions),
    ...pack.packQuestions.map((q) =>
      q.id === 'corpus-id'
        ? {
            ...q,
            question: `Confirm this run should use corpus ${pack.corpus.corpus_id} retrieved ${pack.corpus.retrieved_at}.`,
          }
        : q,
    ),
  ]

  const ctx: EngineContext = {
    provider_ref: input.provider_ref,
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
  for (const claim of pack.claims) {
    const list = byCheck.get(claim.cross_check) ?? []
    list.push(claim.id)
    byCheck.set(claim.cross_check, list)
  }
  const cross_checks: CrossCheckSummary[] = [...byCheck.entries()].map(([id, finding_ids]) => ({
    id,
    finding_ids,
    note: findings
      .filter((f) => finding_ids.includes(f.id))
      .map((f) => `${f.id}=${f.grade}`)
      .join('; '),
  }))

  const position: EvidencePosition = {
    run: {
      provider_ref: input.provider_ref,
      period: { from: input.period_from, to: input.period_to },
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
    open_questions: uniqueQuestions(open_questions),
  }

  return sanitisePosition(position, tables.flatMap((t) => t.name_values), pack.extraForbidden)
}
