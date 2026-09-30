import { billingFindings } from '../../engine/crossChecks/billing.ts'
import { cadenceFindings } from '../../engine/crossChecks/cadence.ts'
import { classificationFindings } from '../../engine/crossChecks/classification.ts'
import { competencyFindings } from '../../engine/crossChecks/competency.ts'
import { consentFindings } from '../../engine/crossChecks/consent.ts'
import { incidentFindings } from '../../engine/crossChecks/incidents.ts'
import { policyFindings } from '../../engine/crossChecks/policy.ts'
import { uncoveredFinding } from '../../engine/finding.ts'
import type { JurisdictionPack } from '../../engine/pack.ts'
import type { CorpusClaim } from '../../engine/types.ts'
import { engCqcColumns } from './columns.ts'
import claimsDoc from './corpus/claims.json'
import manifestDoc from './corpus/manifest.json'
import { ENG_CQC_DEMO_PERIOD, ENG_CQC_DEMO_PROVIDER, engCqcDemoFiles } from './demo.ts'
import { ENG_CQC_WEIGHTS, engCqcHeadline } from './headlines.ts'

export const CQC_RATING_FORBIDDEN = [
  /\brequires improvement\b/i,
  /\binadequate\b/i,
  /\binspection[-\s]?ready\b/i,
  /\bsurvey[-\s]?ready\b/i,
  /\brated (as )?(outstanding|good)\b/i,
]

export const engCqcPack: JurisdictionPack = {
  id: 'eng-cqc-homecare',
  label: 'England · CQC homecare',
  market: 'England',
  kicker: 'Elder-Technology · England CQC homecare',
  locale: 'en-GB',
  banner:
    'This is an evidence position against process records, not a CQC rating and not a compliance determination. It does not say whether a provider will pass or fail an inspection. Grades are PRESENT, PARTIAL, STALE, CONTRADICTED, MISSING, or NOT_TESTABLE_FROM_DATA.',
  corpus: manifestDoc,
  claims: claimsDoc.claims as CorpusClaim[],
  columns: engCqcColumns,
  runChecks: (ctx) => [
    ...billingFindings(ctx, {
      unmatchedClaims: 'CC-CQC-VISIT-UNMATCHED-INVOICES',
      unmatchedDeliveries: 'CC-CQC-VISIT-UNMATCHED-VISITS',
      duration: 'CC-CQC-VISIT-DURATION',
    }),
    ...consentFindings(ctx, { link: 'CC-CQC-CONSENT-LINK' }),
    ...competencyFindings(ctx, {
      onDate: 'CC-CQC-STAFF-ON-DATE',
      expiredNow: 'CC-CQC-STAFF-EXPIRED-NOW',
    }),
    ...cadenceFindings(ctx, {
      interval: 'CC-CQC-PLAN-INTERVAL',
      trigger: 'CC-CQC-PLAN-AFTER-SAFEGUARDING',
      intervalArtefact:
        'A corpus extract stating the required care-plan review interval (days or months)',
    }),
    ...incidentFindings(ctx, { lifecycle: 'CC-CQC-SAFEGUARDING-LIFECYCLE' }),
    ...policyFindings(ctx, {
      currency: 'CC-CQC-POLICY-CURRENCY',
      enactment: 'CC-CQC-POLICY-ENACTMENT',
    }),
    ...classificationFindings(ctx, {
      internal: 'CC-CQC-NEEDS-INTERNAL',
      official: 'CC-CQC-NEEDS-OFFICIAL-MAP',
      officialArtefact: 'Official needs-to-service mapping table in the loaded corpus',
    }),
    uncoveredFinding(
      ctx,
      'CC-CQC-EXPERIENCE',
      "CQC people's experience evidence such as surveys, interviews, or Give feedback on care submissions. Operational visit and invoice extracts are not that category.",
    ),
    uncoveredFinding(
      ctx,
      'CC-CQC-OBSERVATION',
      'On-site observation of care. Spreadsheet exports cannot supply this category.',
    ),
  ],
  packQuestions: [
    {
      id: 'corpus-interval',
      question:
        'Which clause in the loaded CQC or regulation corpus does this provider treat as the care-plan review interval? It is not in the loaded corpus.',
      related_claim_id: 'CC-CQC-PLAN-INTERVAL',
    },
    {
      id: 'corpus-needs-map',
      question:
        'Where is the official needs-to-service mapping the provider uses? It is not in the loaded corpus.',
      related_claim_id: 'CC-CQC-NEEDS-OFFICIAL-MAP',
    },
    {
      id: 'corpus-id',
      question: 'Confirm corpus.',
      related_claim_id: '',
    },
  ],
  headline: engCqcHeadline,
  claimWeights: ENG_CQC_WEIGHTS,
  extraForbidden: CQC_RATING_FORBIDDEN,
  demo: {
    provider_ref: ENG_CQC_DEMO_PROVIDER,
    period: ENG_CQC_DEMO_PERIOD,
    files: engCqcDemoFiles,
    drop_file: 'invoices.csv',
    drop_label: 'Demo without invoices',
  },
}
