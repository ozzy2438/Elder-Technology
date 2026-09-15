import { billingFindings } from './crossChecks/billing.ts'
import { cadenceFindings } from './crossChecks/cadence.ts'
import { classificationFindings } from './crossChecks/classification.ts'
import { competencyFindings } from './crossChecks/competency.ts'
import { consentFindings } from './crossChecks/consent.ts'
import { incidentFindings } from './crossChecks/incidents.ts'
import { policyFindings } from './crossChecks/policy.ts'
import { corpusClaims, corpusManifest } from './corpus.ts'
import { sanitisePosition } from './guards.ts'
import { groupTables, toIntakeFile, unassessableFor } from './intake.ts'
import { parseFile } from './parse.ts'
import { sortFindings, uniqueQuestions } from './report.ts'
import type { CrossCheckSummary, EngineContext, EvidencePosition, OpenQuestion } from './types.ts'

export interface RunInput {
  provider_ref: string
  period_from: string
  period_to: string
  files: File[]
  generated_at?: string
}

export async function runAnalysis(input: RunInput): Promise<EvidencePosition> {
  const tables = []
  for (const file of input.files) {
    tables.push(await parseFile(file))
  }
  const grouped = groupTables(tables)
  const open_questions: OpenQuestion[] = tables.flatMap((t) => t.open_questions)
  open_questions.push({
    id: 'corpus-interval',
    question:
      'Which clause in the Support at Home program manual or Strengthened Quality Standards does this provider treat as the care-plan review interval? It is not in the loaded corpus.',
    related_claim_id: 'CC-CADENCE-INTERVAL',
  })
  open_questions.push({
    id: 'corpus-class-map',
    question:
      'Where is the official Support at Home classification-to-service mapping the provider uses? It is not in the loaded corpus.',
    related_claim_id: 'CC-CLASS-OFFICIAL-MAP',
  })
  open_questions.push({
    id: 'corpus-id',
    question: `Confirm this run should use corpus ${corpusManifest.corpus_id} retrieved ${corpusManifest.retrieved_at}.`,
    related_claim_id: '',
  })

  const ctx: EngineContext = {
    provider_ref: input.provider_ref,
    period: { from: input.period_from, to: input.period_to },
    generated_at: input.generated_at ?? new Date().toISOString(),
    tables: grouped,
    intake_files: tables.map(toIntakeFile),
    open_questions,
  }

  const findings = [
    ...billingFindings(ctx),
    ...consentFindings(ctx),
    ...competencyFindings(ctx),
    ...cadenceFindings(ctx),
    ...incidentFindings(ctx),
    ...policyFindings(ctx),
    ...classificationFindings(ctx),
  ]

  const byCheck = new Map<string, string[]>()
  for (const claim of corpusClaims) {
    const list = byCheck.get(claim.cross_check) ?? []
    list.push(claim.id)
    byCheck.set(claim.cross_check, list)
  }
  const cross_checks: CrossCheckSummary[] = [...byCheck.entries()].map(([id, finding_ids]) => ({
    id: id as CrossCheckSummary['id'],
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
    },
    intake: {
      files: ctx.intake_files,
      unassessable_requirements: unassessableFor(grouped),
    },
    findings: sortFindings(findings),
    cross_checks,
    open_questions: uniqueQuestions(open_questions),
  }

  return sanitisePosition(position, tables.flatMap((t) => t.name_values))
}
