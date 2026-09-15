import { isNameHeader, normaliseHeader } from './redact.ts'
import type { SourceClass } from './types.ts'

export const CLASS_FIELDS: Record<Exclude<SourceClass, 'unknown'>, string[]> = {
  service_delivery: [
    'participant_id',
    'service_date',
    'duration_minutes',
    'worker_id',
    'service_type',
    'record_id',
  ],
  billing: [
    'claim_id',
    'participant_id',
    'claim_date',
    'duration_minutes',
    'worker_id',
    'service_type',
    'amount',
  ],
  participant_register: ['participant_id', 'classification', 'budget_code', 'start_date'],
  care_plans: [
    'participant_id',
    'plan_id',
    'event_type',
    'event_date',
    'is_material',
    'classification',
    'review_date',
  ],
  consent: [
    'consent_id',
    'participant_id',
    'related_plan_id',
    'consent_type',
    'consent_date',
  ],
  incidents: [
    'incident_id',
    'participant_id',
    'recorded_at',
    'actioned_at',
    'closed_at',
    'notified_at',
    'severity',
    'notify_required',
  ],
  workers: ['worker_id', 'role'],
  competency: ['worker_id', 'service_type', 'competency', 'valid_from', 'valid_to'],
  roster: ['worker_id', 'roster_date', 'shift'],
  policies: ['policy_id', 'policy_name', 'topic', 'version', 'approved_at', 'review_due'],
}

const SYNONYMS: Record<string, string[]> = {
  participant_id: ['participant_id', 'participant', 'client_id', 'client', 'consumer_id', 'consumer'],
  worker_id: ['worker_id', 'worker', 'staff_id', 'carer_id', 'employee_id'],
  service_date: ['service_date', 'delivery_date', 'visit_date', 'date_of_service'],
  claim_date: ['claim_date', 'billing_date', 'invoice_date'],
  duration_minutes: ['duration_minutes', 'duration', 'minutes', 'hours', 'duration_hours', 'time_minutes'],
  service_type: ['service_type', 'service', 'item', 'service_code', 'service_item'],
  record_id: ['record_id', 'delivery_id', 'visit_id', 'service_id'],
  claim_id: ['claim_id', 'invoice_id', 'billing_id', 'claim_number'],
  amount: ['amount', 'claimed_amount', 'claim_amount', 'fee', 'charge'],
  classification: ['classification', 'funding_classification', 'sah_classification', 'level'],
  budget_code: ['budget_code', 'budget', 'funding_code'],
  start_date: ['start_date', 'commencement_date', 'package_start'],
  plan_id: ['plan_id', 'care_plan_id', 'support_plan_id'],
  event_type: ['event_type', 'plan_event', 'change_type'],
  event_date: ['event_date', 'plan_date', 'changed_at'],
  is_material: ['is_material', 'material_change', 'material'],
  review_date: ['review_date', 'reviewed_at', 'last_review'],
  consent_id: ['consent_id'],
  related_plan_id: ['related_plan_id', 'plan_id', 'care_plan_id'],
  consent_type: ['consent_type', 'engagement_type'],
  consent_date: ['consent_date', 'engagement_date', 'signed_date'],
  incident_id: ['incident_id', 'incident', 'incident_number'],
  recorded_at: ['recorded_at', 'incident_date', 'raised_at'],
  actioned_at: ['actioned_at', 'action_date', 'responded_at'],
  closed_at: ['closed_at', 'closed_date', 'resolved_at'],
  notified_at: ['notified_at', 'notification_date', 'sirs_notified_at'],
  severity: ['severity', 'priority'],
  notify_required: ['notify_required', 'reportable', 'sirs_required'],
  role: ['role', 'position', 'job_title'],
  competency: ['competency', 'qualification', 'ticket'],
  valid_from: ['valid_from', 'issued_on', 'competency_start'],
  valid_to: ['valid_to', 'expires_on', 'expiry', 'competency_end'],
  roster_date: ['roster_date', 'shift_date'],
  shift: ['shift', 'shift_type'],
  policy_id: ['policy_id', 'document_id'],
  policy_name: ['policy_name', 'document_name', 'title'],
  topic: ['topic', 'policy_topic', 'domain'],
  version: ['version', 'policy_version'],
  approved_at: ['approved_at', 'approval_date', 'approved_date'],
  review_due: ['review_due', 'next_review', 'review_by'],
  date: ['date'],
}

const UNIQUE_HINTS: Partial<Record<Exclude<SourceClass, 'unknown'>, string[]>> = {
  billing: ['claim_id', 'amount'],
  service_delivery: ['record_id', 'service_date', 'duration_minutes'],
  participant_register: ['budget_code', 'classification'],
  care_plans: ['plan_id', 'event_type', 'is_material'],
  consent: ['consent_id', 'consent_type', 'consent_date'],
  incidents: ['incident_id', 'recorded_at', 'actioned_at'],
  competency: ['valid_from', 'valid_to', 'competency'],
  workers: ['role'],
  policies: ['policy_name', 'review_due', 'approved_at'],
  roster: ['roster_date', 'shift'],
}

export function mapHeaders(headers: string[]): {
  mapping: Record<string, string>
  reverse: Record<string, string>
} {
  const mapping: Record<string, string> = {}
  const reverse: Record<string, string> = {}
  for (const header of headers) {
    if (isNameHeader(header)) continue
    const norm = normaliseHeader(header)
    for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
      if (mapping[canonical]) continue
      if (aliases.includes(norm) || norm === canonical) {
        mapping[canonical] = header
        reverse[header] = canonical
        break
      }
    }
  }
  return { mapping, reverse }
}

export function scoreClass(headers: string[]): { source_class: SourceClass; confidence: number } {
  const { mapping } = mapHeaders(headers)
  const mapped = new Set(Object.keys(mapping))
  let best: SourceClass = 'unknown'
  let bestScore = 0
  let second = 0
  for (const [cls, fields] of Object.entries(CLASS_FIELDS) as Array<
    [Exclude<SourceClass, 'unknown'>, string[]]
  >) {
    const hits = fields.filter((f) => mapped.has(f)).length
    const unique = (UNIQUE_HINTS[cls] ?? []).filter((f) => mapped.has(f)).length
    const score = hits + unique * 2
    if (score > bestScore) {
      second = bestScore
      bestScore = score
      best = cls
    } else if (score > second) {
      second = score
    }
  }
  if (bestScore < 3) return { source_class: 'unknown', confidence: 0 }
  const confidence = Math.min(1, (bestScore - second) / 8 + hitsRatio(best, mapped))
  return { source_class: best, confidence: Number(confidence.toFixed(2)) }
}

function hitsRatio(cls: SourceClass, mapped: Set<string>): number {
  if (cls === 'unknown') return 0
  const fields = CLASS_FIELDS[cls]
  return fields.filter((f) => mapped.has(f)).length / fields.length
}

export function requiredForClass(cls: SourceClass): string[] {
  if (cls === 'unknown') return []
  return CLASS_FIELDS[cls]
}
