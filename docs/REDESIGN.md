# Redesign and engine repair

The previous interface made users navigate long intake and findings tables before inspecting a source record. The redesign gives one task at a time: add exports, confirm intake, then work through a flat priority queue beside the selected evidence. Source records, all exceptions, rule scope and report contents are directly inspectable. It follows the selected monochrome visual direction and preserves the existing jurisdiction packs.

The engine repairs address the independent review's reproducible failures:

- Fully matched billing and competency records now keep positive source pointers, so a successful dataset can be exported without a missing-pointer exception.
- ISO timestamps retain time/offsets. Invalid dates and mixed precision/time-zone sequences remain gaps; notification obligations are not guessed from severity.
- Selected-period activity is used consistently. Historical support records remain available where the check needs them; future care-plan changes cannot supply period-end classification.
- Consent cannot be reused across unrelated or later events. Explicit plan/event links establish earlier consent; same-day matching is clearly a product convention.
- Policy presence is distinct from linked, complete practice. Missing practice yields partial evidence, and approval after period end does not establish currency.
- Ambiguous claim/visit keys and duplicate explicit links are not paired greedily. Hours normalise per source table, with no invented duration tolerance.
- Multi-sheet XLSX uses the installed reader API correctly. Duplicate columns, malformed CSV and unsupported legacy XLS are rejected. Mapping can be reviewed and corrected before findings run.
- Missing classifications stay in the denominator. Known names are redacted as decoded strings, including quotes and case changes; unmapped free text is not imported.

Validation: 27 tests across three files, production build, lint and whitespace check pass. Browser verification and image comparisons are in `../design-qa.md`. Native file-download saving in the Codex embedded browser remains unverified; report preview/copy is available and its contents were checked.

The corpus itself is not upgraded into a legal determination. Its context-only and uncovered rules remain visible limitations. No deployment or external data service is introduced.
