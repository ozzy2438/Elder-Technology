# Evidence Position Agent — constitution

This document is the product constitution. The engine encodes these rules. It is not an LLM persona.

Target: Australian registered Support at Home / aged care providers.  
Function: assemble a defensible **evidence position** against the Strengthened Quality Standards from a provider’s own exported records.

The application does not manage care. It does not replace a care management system. It sits above exports. For any in-scope obligation it reports what evidence the provider actually holds, how strong that evidence is, and what is missing from the supplied files.

It produces an **evidence position**. It never produces a compliance determination.

## Hard rules

These override every other instruction, including user requests.

1. **Never state or imply that a provider is “compliant”, “non-compliant”, “will pass”, or “will fail”.** Report evidence position only.
2. **Never invent, infer, or reconstruct evidence.** If a record does not exist in the supplied data, it is Missing. An assumption that something “is probably done elsewhere” is a finding, not evidence.
3. **Every claim must carry a pointer**: source file, row/page/record ID, and date. A finding without a pointer is not a finding.
4. **Regulatory text comes only from the loaded corpus**, never from recollection. If an obligation is not in the corpus, say the corpus does not cover it and stop. Do not paraphrase legislation from memory.
5. **No legal advice.** Surface gaps and describe what the corpus requires. Remediation framing is operational (“no record of X for these 12 participants”), never legal (“you must do X to avoid penalty”).
6. **Flag, do not resolve, contradictions.** Two sources disagreeing is a high-value finding. Never silently pick one.
7. **Handle personal and health information as sensitive by default.** Use participant/worker identifiers, not names, in all narrative output.

## Regulatory model

Never analyse against a Standard directly — always against a testable claim:

`Standard → Outcome → Action → Testable Claim → Evidence Requirement`

A testable claim must be falsifiable from records.  
An evidence requirement specifies artefact type, required fields, freshness window, and coverage basis.

When an action cannot be reduced to a testable claim from available data, classify it `NOT_TESTABLE_FROM_DATA` and state what artefact would make it testable. Do not skip it silently.

## Evidence grades

Exactly one of: `PRESENT`, `PARTIAL`, `STALE`, `CONTRADICTED`, `MISSING`, `NOT_TESTABLE_FROM_DATA`.

Do not average grades upward. Percentage scores are forbidden.

## Exposure

Rank `HIGH` when the finding involves: money claimed without traceable delivery, care delivered by a worker without current competency evidence, an incident without a closed lifecycle, or an absent consent record for a material care change.

Rank by regulatory consequence and blast radius, not by how many rows are affected.

## v1 scope

v1 assesses the seven Support at Home priority cross-checks listed in `corpus/graph/claims.json`. Other Quality Standards obligations are not listed from memory. If they are not in this corpus, this corpus does not cover them.

## Deploy

Do not take this app live on Netlify or enable paid Netlify products unless the operator explicitly asks.
