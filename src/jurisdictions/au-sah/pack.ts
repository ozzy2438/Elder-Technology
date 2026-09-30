import { billingFindings } from '../../engine/crossChecks/billing.ts'
import { cadenceFindings } from '../../engine/crossChecks/cadence.ts'
import { classificationFindings } from '../../engine/crossChecks/classification.ts'
import { competencyFindings } from '../../engine/crossChecks/competency.ts'
import { consentFindings } from '../../engine/crossChecks/consent.ts'
import { incidentFindings } from '../../engine/crossChecks/incidents.ts'
import { policyFindings } from '../../engine/crossChecks/policy.ts'
import type { JurisdictionPack } from '../../engine/pack.ts'
import type { CorpusClaim } from '../../engine/types.ts'
import { auSahColumns } from './columns.ts'
import claimsDoc from './corpus/claims.json'
import manifestDoc from './corpus/manifest.json'
import { AU_SAH_DEMO_PERIOD, AU_SAH_DEMO_PROVIDER, auSahDemoFiles } from './demo.ts'
import { AU_SAH_WEIGHTS, auSahHeadline } from './headlines.ts'

export const auSahPack: JurisdictionPack = {
  id: 'au-sah',
  label: 'Australia · Support at Home',
  market: 'Australia',
  kicker: 'Elder-Technology · Support at Home',
  locale: 'en-AU',
  banner:
    'This is an evidence position, not a compliance determination. It does not say whether a provider will pass or fail an audit. It reports what the supplied records show, with pointers, and what they do not show.',
  corpus: manifestDoc,
  claims: claimsDoc.claims as CorpusClaim[],
  columns: auSahColumns,
  runChecks: (ctx) => [
    ...billingFindings(ctx, {
      unmatchedClaims: 'CC-BILL-UNMATCHED-CLAIMS',
      unmatchedDeliveries: 'CC-BILL-UNMATCHED-DELIVERIES',
      duration: 'CC-BILL-DURATION',
    }),
    ...consentFindings(ctx, { link: 'CC-CONSENT-LINK' }),
    ...competencyFindings(ctx, { onDate: 'CC-COMP-ON-DATE', expiredNow: 'CC-COMP-EXPIRED-NOW' }),
    ...cadenceFindings(ctx, {
      interval: 'CC-CADENCE-INTERVAL',
      trigger: 'CC-CADENCE-TRIGGER',
      intervalArtefact:
        'A corpus extract stating the required care-plan review interval (days or months)',
    }),
    ...incidentFindings(ctx, { lifecycle: 'CC-INCIDENT-LIFECYCLE' }),
    ...policyFindings(ctx, { currency: 'CC-POLICY-CURRENCY', enactment: 'CC-POLICY-ENACTMENT' }),
    ...classificationFindings(ctx, {
      internal: 'CC-CLASS-INTERNAL',
      official: 'CC-CLASS-OFFICIAL-MAP',
      officialArtefact: 'Official Support at Home classification-to-service table in the loaded corpus',
    }),
  ],
  packQuestions: [
    {
      id: 'corpus-interval',
      question:
        'Which clause in the Support at Home program manual or Strengthened Quality Standards does this provider treat as the care-plan review interval? It is not in the loaded corpus.',
      related_claim_id: 'CC-CADENCE-INTERVAL',
    },
    {
      id: 'corpus-class-map',
      question:
        'Where is the official Support at Home classification-to-service mapping the provider uses? It is not in the loaded corpus.',
      related_claim_id: 'CC-CLASS-OFFICIAL-MAP',
    },
    {
      id: 'corpus-id',
      question: 'Confirm corpus.',
      related_claim_id: '',
    },
  ],
  headline: auSahHeadline,
  claimWeights: AU_SAH_WEIGHTS,
  extraForbidden: [],
  demo: {
    provider_ref: AU_SAH_DEMO_PROVIDER,
    period: AU_SAH_DEMO_PERIOD,
    files: auSahDemoFiles,
    drop_file: 'billing.csv',
    drop_label: 'Demo without billing',
  },
}
