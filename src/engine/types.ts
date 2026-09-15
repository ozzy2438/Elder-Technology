export type Grade =
  | 'PRESENT'
  | 'PARTIAL'
  | 'STALE'
  | 'CONTRADICTED'
  | 'MISSING'
  | 'NOT_TESTABLE_FROM_DATA'

export type Exposure = 'HIGH' | 'MEDIUM' | 'LOW'

export type SourceClass =
  | 'service_delivery'
  | 'billing'
  | 'participant_register'
  | 'care_plans'
  | 'consent'
  | 'incidents'
  | 'workers'
  | 'competency'
  | 'roster'
  | 'policies'
  | 'unknown'

export type CrossCheckId =
  | 'billing_reconciliation'
  | 'consent_engagement'
  | 'worker_competency'
  | 'care_plan_cadence'
  | 'incident_lifecycle'
  | 'policy_currency_enactment'
  | 'classification_coherence'

export interface CorpusPointer {
  source_id: string
  locator: string
  quote: string
}

export interface EvidenceRequirement {
  artefact_types: SourceClass[]
  required_fields: string[]
  freshness_window: string
  coverage_basis: string
}

export interface CorpusClaim {
  id: string
  cross_check: CrossCheckId
  standard: string
  outcome: string
  action: string
  testable_claim: string
  corpus_status: 'grounded' | 'grounded_context_only' | 'uncovered'
  corpus_pointers: CorpusPointer[]
  evidence_requirement: EvidenceRequirement
  default_exposure_if_gap: Exposure
  corpus_note: string
}

export interface EvidencePointer {
  source_file: string
  locator: string
  date: string
  extract: string
}

export interface FindingException {
  ref: string
  reason: string
  locator: string
}

export interface Finding {
  id: string
  standard: string
  outcome: string
  testable_claim: string
  grade: Grade
  coverage: { assessed: number; satisfied: number }
  evidence: EvidencePointer[]
  exceptions: FindingException[]
  exposure: Exposure
  exposure_rationale: string
  closes_with: string
}

export interface IntakeFileReport {
  source_file: string
  source_class: SourceClass
  mapping_confidence: number
  row_count: number
  date_min: string | null
  date_max: string | null
  null_rates: Record<string, number>
  mapped_fields: Record<string, string>
  unmapped_required: string[]
  name_fields_stripped: string[]
}

export interface UnassessableRequirement {
  claim_id: string
  reason: string
  missing_source_classes: SourceClass[]
}

export interface CrossCheckSummary {
  id: CrossCheckId
  finding_ids: string[]
  note: string
}

export interface OpenQuestion {
  id: string
  question: string
  related_claim_id: string
}

export interface RunMeta {
  provider_ref: string
  period: { from: string; to: string }
  sources: string[]
  generated_at: string
}

export interface EvidencePosition {
  run: RunMeta
  intake: {
    files: IntakeFileReport[]
    unassessable_requirements: UnassessableRequirement[]
  }
  findings: Finding[]
  cross_checks: CrossCheckSummary[]
  open_questions: OpenQuestion[]
}

export interface CanonicalRow {
  source_file: string
  locator: string
  values: Record<string, string>
}

export interface ParsedTable {
  source_file: string
  source_class: SourceClass
  mapping_confidence: number
  mapped_fields: Record<string, string>
  unmapped_required: string[]
  name_fields_stripped: string[]
  name_values: string[]
  rows: CanonicalRow[]
  date_min: string | null
  date_max: string | null
  null_rates: Record<string, number>
  open_questions: OpenQuestion[]
}

export interface EngineContext {
  provider_ref: string
  period: { from: string; to: string }
  generated_at: string
  tables: Record<SourceClass, ParsedTable[]>
  intake_files: IntakeFileReport[]
  open_questions: OpenQuestion[]
}
