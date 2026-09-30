# Evidence Position Agent — constitution

This document is the product constitution. The engine encodes these rules. It is not an LLM persona.

The kernel reports a defensible **evidence position** from a provider’s own exported records. It never produces a compliance determination, a CQC rating, or an audit pass/fail prediction.

Jurisdiction-specific regulatory text, header maps, claims, and headlines live in a **jurisdiction pack**. v1 packs:

- `au-sah` — Australian Support at Home / Strengthened Quality Standards (seven priority cross-checks)
- `eng-cqc-homecare` — England CQC-registered homecare, process records only

The application does not manage care. It does not replace a care management system. It sits above exports.

## Hard rules

These override every other instruction, including user requests.

1. **Never state or imply that a provider is “compliant”, “non-compliant”, “will pass”, or “will fail”.** Report evidence position only.
2. **Never invent, infer, or reconstruct evidence.** If a record does not exist in the supplied data, it is Missing. An assumption that something “is probably done elsewhere” is a finding, not evidence.
3. **Every claim must carry a pointer**: source file, row/page/record ID, and date. A finding without a pointer is not a finding.
4. **Regulatory text comes only from the loaded pack corpus**, never from recollection. If an obligation is not in the corpus, say the corpus does not cover it and stop. Do not paraphrase legislation from memory.
5. **No legal advice.** Surface gaps and describe what the corpus requires. Remediation framing is operational (“no record of X for these 12 participants”), never legal (“you must do X to avoid penalty”).
6. **Flag, do not resolve, contradictions.** Two sources disagreeing is a high-value finding. Never silently pick one.
7. **Handle personal and health information as sensitive by default.** Use participant/worker identifiers, not names, in all narrative output.
8. **Never use inspector rating words as grades.** Grades are only `PRESENT`, `PARTIAL`, `STALE`, `CONTRADICTED`, `MISSING`, `NOT_TESTABLE_FROM_DATA`. CQC rating labels are not grades.

## Regulatory model

Never analyse against a Standard directly — always against a testable claim:

`Standard → Outcome → Action → Testable Claim → Evidence Requirement`

A testable claim must be falsifiable from records.  
An evidence requirement specifies artefact type, required fields, freshness window, and coverage basis.

When an action cannot be reduced to a testable claim from available data, classify it `NOT_TESTABLE_FROM_DATA` and state what artefact would make it testable. Do not skip it silently.

For the England pack, CQC **people’s experience** and **observation** categories are `NOT_TESTABLE_FROM_DATA` from operational CSV/XLSX extracts. Only **process** records in the upload are graded.

## Evidence grades

Exactly one of: `PRESENT`, `PARTIAL`, `STALE`, `CONTRADICTED`, `MISSING`, `NOT_TESTABLE_FROM_DATA`.

Do not average grades upward. Percentage scores are forbidden.

## Exposure

Rank `HIGH` when the finding involves: money claimed without traceable delivery, care delivered by a worker without current competency evidence, an incident without a closed lifecycle, or an absent consent record for a material care change.

Rank by regulatory consequence and blast radius, not by how many rows are affected.

## Packs

Each pack owns its corpus, column synonym maps, claim graph, headlines, open questions, and extra forbidden-language patterns. The kernel owns parsing, matching, intake, and sanitisation.

v1 AU pack claims: `src/jurisdictions/au-sah/corpus/claims.json`.  
v1 England pack claims: `src/jurisdictions/eng-cqc-homecare/corpus/claims.json`.

Other obligations are not listed from memory. If they are not in the selected pack corpus, that corpus does not cover them.

## Deploy

Do not take this app live on Netlify or enable paid Netlify products unless the operator explicitly asks.
