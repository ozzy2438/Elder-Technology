# Elder — Evidence review

A local web app that turns CSV/XLSX exports into a reviewable evidence position. The interface uses a flat monochrome finding list, source-record inspection and a short intake flow. It makes no compliance determination or CQC rating.

## Run

```sh
npm ci
npm test
npm run dev
```

Open the printed local URL. Use **Explore the demo** for synthetic data, or **Add exports** for your files. The font and icons are bundled locally. Records are held in browser memory; only the theme preference is saved. Refreshing clears the review.

## Review workflow

1. Add exports, a provider identifier and the analysis period. Files with the same name replace earlier files in that intake.
2. Check the detected source types, mapped columns, date ranges and data issues. Expand a file to correct its mapping. Apply changes before continuing.
3. Review the findings in exposure order. Open source records, inspect every exception using the record selector, and expand **Rule and scope** for coverage, assumptions and regulatory source context.
4. Use **Add evidence** to add/replace files, confirm intake and recompute. Gaps cannot be marked resolved without rerunning the evidence checks.
5. **Export** previews either a readable report or JSON. Copy the report, or download it using the browser's save behaviour.

**Needs attention**, **Evidence found** and **Not assessed** are separate views. Zero assessable activity does not produce a success grade. Neither coverage nor queue counts are a compliance score. Country changes start a new local review. Light/dark themes and a list-to-detail mobile layout are supported.

## Packs and boundaries

- Australia · Support at Home (`au-sah`): seven operational cross-check groups.
- England · CQC homecare (`eng-cqc-homecare`): process extracts; experience and observation require other evidence.

The bundled corpus provides regulatory context for most field-level checks. The interface explicitly distinguishes that context from an exact source-grounded obligation. Required review intervals, official classification/service mapping, notification time limits, and additional triggers are not invented. Corpus applicability still needs verification before operational reliance. No live source refresh, care-management connector, authentication, PDF ingestion or external AI service is added.

## Import rules

- CSV and XLSX only; convert legacy XLS first. Every non-empty XLSX sheet becomes a separate table with sheet-qualified row pointers.
- Source classification uses headers. Tied/low-confidence classifications remain unidentified until confirmed. Ambiguous column aliases are not selected automatically.
- Names and unmapped free text are excluded. Known name values are redacted from mapped values, case-insensitively. This is minimisation, not a guarantee of full de-identification; identifiers remain in the review/export.
- Dates accept YYYY-MM-DD, DD/MM/YYYY and ISO timestamps. Invalid dates stay visible as gaps. Source time precision and explicit offsets are retained; missing time zones are not invented.
- Hours convert to minutes per source table. Unique claim/visit pairing is required; duplicate candidate keys/links remain questions.
- Consent needs the specific participant and plan. Same-day unique event matching is a product convention; earlier consent needs `related_event_id` matching the plan's `event_id`. This is not a quoted legal consent time limit.
- Competency needs a named competency and complete valid-from/to bounds covering the visit.
- Policy practice evidence needs `related_policy_id` and `related_policy_version`, applicable dates and complete operational fields. Policy register presence alone is insufficient.

Canonical export shapes and synthetic examples are in [`fixtures/au-sah`](fixtures/au-sah) and [`fixtures/eng-cqc-homecare`](fixtures/eng-cqc-homecare). Optional explicit billing links use `related_record_id`.

## Validation and evidence

`npm test`, `npm run build`, `npm run lint` and `git diff --check` pass. Tests cover both packs plus review regressions, multi-sheet XLSX, source-pointer completeness, timestamp precision, temporal scope, ambiguous matches, policy practice and name redaction. Browser QA covers intake, mapping edits, source inspection, missing-source reruns, both packs, report preview/copy, themes and 320/390/768/1487 px layouts.

The Codex embedded browser did not expose a file-download event during QA. Report contents and the copy success state were verified; actual native file saving still needs verification in a standard browser. No download is claimed solely from clicking its button.

See [`design-qa.md`](design-qa.md) for reference comparisons and captured states. The local preview is a development handoff; nothing has been deployed.

## Architecture

- [`src/engine`](src/engine): intake, conservative matching, temporal checks, pointers and redaction.
- [`src/jurisdictions`](src/jurisdictions): corpus, claims and jurisdiction-specific header maps.
- [`src/ui`](src/ui): upload, intake, review, source records and exports.
- [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md): evidence-position boundaries.
