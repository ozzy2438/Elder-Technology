import type { ColumnMaps } from '../../engine/columns.ts'
import { auSahColumns } from '../au-sah/columns.ts'

function mergeAliases(
  base: Record<string, string[]>,
  extra: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...base }
  for (const [key, aliases] of Object.entries(extra)) {
    out[key] = [...new Set([...(out[key] ?? []), ...aliases])]
  }
  return out
}

export const engCqcColumns: ColumnMaps = {
  classFields: auSahColumns.classFields,
  uniqueHints: auSahColumns.uniqueHints,
  synonyms: mergeAliases(auSahColumns.synonyms, {
    participant_id: ['service_user_id', 'service_user', 'person_id', 'su_id'],
    worker_id: ['care_worker_id', 'care_worker'],
    service_date: ['call_date', 'attendance_date'],
    claim_date: ['commissioned_date', 'billed_date'],
    duration_minutes: ['visit_minutes', 'commissioned_minutes'],
    service_type: ['visit_type', 'call_type'],
    record_id: ['call_id'],
    claim_id: ['commission_id'],
    classification: ['needs_summary', 'assessed_needs', 'package_type', 'banding'],
    incident_id: ['safeguarding_id', 'concern_id', 'safeguarding'],
    recorded_at: ['concern_date', 'safeguarding_date'],
    notified_at: ['cqc_notified_at', 'local_authority_notified_at'],
    notify_required: ['notifiable', 'cqc_notifiable'],
    competency: ['training'],
    valid_from: ['training_start'],
    valid_to: ['training_end'],
  }),
}
