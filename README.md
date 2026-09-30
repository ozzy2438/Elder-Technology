# Elder-Technology — Evidence Position Agent

Local web app. It turns messy CSV/XLSX exports into an **evidence position**. It does not manage care, and it does not make a compliance determination or a CQC rating.

Jurisdiction packs:

- **Australia · Support at Home** (`au-sah`) — seven Strengthened Quality Standards / Support at Home priority cross-checks
- **England · CQC homecare** (`eng-cqc-homecare`) — process records against loaded CQC/regulation extracts; people’s experience and observation are not testable from these files

## What it is not

- Not a finding that a provider is “compliant” or “non-compliant”
- Not a prediction that an audit or inspection will pass or fail
- Not a CQC rating (Outstanding / Good / Requires improvement / Inadequate are not grades)
- Not legal advice
- Not a live Netlify site (do not deploy unless you explicitly ask)

## Run locally

```bash
npm install
npm test
npm run dev
```

Open the printed localhost URL. Choose a market, then **Load demo**. Records stay in the browser.

`npm run preview` serves the production build locally. Do not run `netlify deploy`.

## Two-minute stakeholder demo

1. `npm run dev` and open the local URL. Say this is an evidence position from the provider’s own exports, not an audit result.
2. Leave **Australia · Support at Home** selected. Press **Load demo**.
3. Walk **1 Intake** (files, classes, dates) then **2 Highest-exposure findings** (claim, pointer, date). Mention coverage is a fraction, not a score.
4. Switch **Market** to **England · CQC homecare**. Press **Load demo** again. The banner stays an evidence position, not a CQC rating.
5. Open **More options** and press **Demo without invoices**. The invoice claims say the extract was not supplied.

Provider ref, period, and your own CSV/XLSX files live under **More options**. **Run** uses those files. **Download JSON** sits beside the top findings.

## Architecture

- Kernel: [`src/engine/`](src/engine/) — parse, match, intake, sanitise
- Packs: [`src/jurisdictions/`](src/jurisdictions/) — corpus, header maps, claims, headlines
- Product rules: [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)

Regulatory wording comes only from the selected pack corpus. If an obligation is not there, the run says so and does not invent it.

## Expected export shapes

Classify by headers, not filename. Name columns are stripped from narrative. Canonical fields are the same across packs; local header names are pack synonym maps (for example `service_user_id` and `visit_date` in England).

| Class | Useful headers |
|---|---|
| service_delivery | participant_id / service_user_id, service_date / visit_date, duration_minutes, worker_id, service_type |
| billing | claim_id / invoice_id, participant_id, claim_date / invoice_date, duration_minutes, worker_id, service_type, amount |
| participant_register | participant_id, classification / needs_summary, start_date |
| care_plans | participant_id, plan_id, event_type, event_date, is_material, classification, review_date |
| consent | consent_id, participant_id, related_plan_id, consent_type, consent_date |
| incidents | incident_id / safeguarding_id, recorded_at, actioned_at, closed_at, notified_at, notify_required |
| competency | worker_id, service_type, competency / training, valid_from, valid_to |
| policies | policy_id, policy_name, topic, version, approved_at, review_due |

Synthetic packs: [`fixtures/au-sah/`](fixtures/au-sah/), [`fixtures/eng-cqc-homecare/`](fixtures/eng-cqc-homecare/).
