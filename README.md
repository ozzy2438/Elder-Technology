# Elder-Technology — Evidence Position Agent

Local web app for Australian Support at Home providers. It turns messy CSV/XLSX exports into an **evidence position** against seven priority cross-checks. It does not manage care, and it does not make a compliance determination.

## What it is not

- Not a finding that a provider is “compliant” or “non-compliant”
- Not a prediction that an audit will pass or fail
- Not legal advice
- Not a live Netlify site (do not deploy unless you explicitly ask)

## Run locally

```bash
npm install
npm test
npm run dev
```

Open the printed localhost URL. Records stay in the browser. Use **Load demo pack** for synthetic IDs only.

`npm run preview` serves the production build locally. Do not run `netlify deploy`.

## v1 scope

Seven Support at Home priority cross-checks, as testable claims in [`corpus/graph/claims.json`](corpus/graph/claims.json):

1. Service record ↔ billing reconciliation (unmatched claims, unmatched deliveries, duration mismatches — separate findings)
2. Consent linked to care-plan creation and material changes
3. Worker competency current **on the date of delivery** (expired-at-delivery vs expired-now)
4. Care-plan review cadence after trigger incidents (interval is not in the loaded corpus, so it is not tested)
5. Incident lifecycle timestamps
6. Policy currency **and** enactment
7. Classification coherence between register and care plan (official classification-to-service table is not in the loaded corpus)

Regulatory wording comes only from the loaded corpus ([`corpus/manifest.json`](corpus/manifest.json)). If an obligation is not there, the run says so and does not invent it.

Product rules: [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md).

## Expected export shapes

Classify by headers, not filename. Name columns are stripped from narrative.

| Class | Useful headers |
|---|---|
| service_delivery | participant_id, service_date, duration_minutes, worker_id, service_type |
| billing | claim_id, participant_id, claim_date, duration_minutes, worker_id, service_type, amount |
| participant_register | participant_id, classification, budget_code, start_date |
| care_plans | participant_id, plan_id, event_type, event_date, is_material, classification, review_date |
| consent | consent_id, participant_id, related_plan_id, consent_type, consent_date |
| incidents | incident_id, participant_id, recorded_at, actioned_at, closed_at, notified_at, notify_required |
| competency | worker_id, service_type, competency, valid_from, valid_to |
| policies | policy_id, policy_name, topic, version, approved_at, review_due |

Synthetic pack: [`fixtures/provider-demo/`](fixtures/provider-demo/).
