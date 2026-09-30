# Design QA — Elder evidence review

**Final result: passed**

## Comparison target and evidence

- Source visual truth: `docs/qa/reference.png`, the monochrome revision of the user-selected two-column design (generated image `exec-140dc092-dbed-43d4-9603-6c70bdaec13b.png`).
- Implementation: `http://127.0.0.1:5177/`, captured through the Codex in-app browser.
- Latest implementation screenshot: `docs/qa/desktop.png`.
- Full-view comparison: `docs/qa/comparison.png`. Both artifacts were placed in the same image and visually inspected together.
- Focused comparison: `docs/qa/comparison-detail.png`, covering the finding heading, source rows, rule disclosure, buttons and scope footer. Both crops are in the same comparison input; the full view alone was not used to judge small controls.
- CSS viewport: 1487 × 1058. Source pixels: 1487 × 1058. Latest implementation pixels: 1487 × 1058. Device pixel ratio: 1; no scaling, density adjustment, browser chrome or device frame.
- State: Australia, light theme, synthetic Jan–Mar 2026 exports, competency finding selected, rule disclosure closed.
- The real engine produces 11 attention checks and two unassessable checks; the reference's illustrative count of five is deliberately not hardcoded. Billing remains first in exposure order, so the selected competency finding is number two. This is a data/state difference, not a substituted layout.

## Findings and comparison history

1. **[P2, fixed] Duplicate explanations pushed actions and the scope footer down.**
   - Evidence: `docs/qa/iteration-1.png` included a separate record-gap block and a second evidence-needed block beneath the primary actions. The reference keeps the source rows and actions together with detail behind the rule disclosure.
   - Fix: moved selected exception rationale and required evidence into **Rule and scope**. Removed the redundant blocks from the default view. The final capture shows both primary actions and the scope footer within the reference-sized viewport.
2. **[P2, fixed] Weak secondary outlines and dense typography drifted from the reference.**
   - Fix: introduced `--control` for visible monochrome secondary outlines, enlarged list titles and the detail heading, and increased the file icon size. Reduced toolbar margins; the two-column structure and flat separators are retained.
   - Post-fix evidence: `docs/qa/desktop.png`, `comparison.png` and `comparison-detail.png` were opened and compared together after these changes.
3. **[P2, fixed] Narrow browser gutters caused horizontal overflow at 320 px.**
   - Fix: removed the 320 px body minimum, reduced narrow header spacing/country selector width, and adjusted the filter text at the smallest breakpoint. Added an accessible name to the icon-only Add exports button.
   - Post-fix DOM measurements: viewport/client/scroll widths were 320/305/305, 768/753/753 and 390/375/375 respectively. No horizontal overflow remained.
4. **[P2, fixed] Unapplied mapping edits could be skipped.**
   - Fix: disable Review evidence while any file mapping is dirty; clear this state only after a successful reparse. Browser check confirmed Continue was disabled before Apply and enabled after it; a removed duration mapping produced a visible field gap.

No actionable P0/P1/P2 findings remain in the selected design and tested primary flow.

## Required fidelity surfaces

- **Fonts/typography:** self-hosted Geist Variable, 650-weight display headings, 600-weight finding titles, regular secondary text. Heading size, tight display tracking, two-line description rhythm and visible source IDs match the reference direction. The reference has slightly heavier rasterised type; the small optical difference is P3. Long real finding titles wrap rather than truncate.
- **Spacing/layout rhythm:** white full-width header, slim context divider, flat left queue, thin vertical split and right detail; no card mosaic, illustration or decorative dashboard. The compact filter/export row is an intentional functional addition. Desktop actions remain side by side; mobile actions stack and list/detail are separate views. Longer exception lists use a record selector, without silently truncating rows.
- **Colours/tokens:** white/near-black, muted neutral copy and gray dividers; dark theme uses the inverse neutral palette. Focus rings and outlines are visible. No blue accent, gradients, score colours or ornamental surfaces. Disabled buttons use reduced opacity.
- **Image quality/assets:** the design contains editable typographic branding and standard UI icons, with no raster illustration assets. Phosphor library icons provide consistent outline strokes and solid queue dots; no hand-drawn SVG, CSS/div art or placeholder image replaces a reference asset. The two source row icons remain sharp at 1×.
- **Copy/content:** headings, dates, counts, IDs and record values come from the review. Missing sources, zero activity and uncovered corpus rules remain distinct from supported evidence. The rule drawer labels operational checks whose corpus provides only regulatory context. Record grade is not a compliance verdict or percentage score. Classification disagreement retains both values.

## Browser interactions tested

- Empty state → demo → explicit intake → review for both AU and England packs.
- Native file chooser accepted a real multi-sheet XLSX: 11 total tables after adding it; its Claims and Visits sheets were independently identified. The automation tool's file-selection operation took unusually long; parsing itself completed promptly.
- File removal, re-intake and analysis without billing: three billing checks became unassessable; no fictional record was shown.
- Mapping editor, dirty-state gate, Apply mapping and visible missing-field result.
- Finding selection, previous/next controls, all source row views, multi-exception selector and Rule and scope.
- Open questions and linked-check navigation.
- Export format selection: JSON preview parsed to 13 findings and 9 supplied files; readable report preview contained 16,997 characters. Copy report returned the browser's success state.
- Theme toggle in both directions; desktop, tablet, 390 px and 320 px responsiveness; mobile list → detail → back.
- Keyboard Enter opens a source record, Escape closes the native dialog; controls have focus-visible rings and readable names. Filters use a native button group rather than an incomplete ARIA tab implementation.
- Browser error/warning log: empty at the final check.

## Explicit test limits / P3 follow-up

- The Codex embedded browser did not expose a download event for Blob saves, even after the anchor was attached to the document and URL lifetime extended. Actual native file saving is **unverified**, not reported as successful. Report preview/content and Copy report work; verify file saving in a standard browser before relying on that route.
- No real provider export or independent end-user usability study was available. Engine tests use synthetic inputs and cover the observed regressions and conservative boundaries.
- The bundled corpus still lacks exact rules for the stated uncovered checks. This is explicitly visible, not solved by a visual redesign.
- P3: optional further typography tuning against a formal brand specification; the selected generated reference does not define an exact font file.

## Implementation checklist

- [x] Preserve selected flat monochrome composition.
- [x] Fix all observed P0/P1/P2 design/primary-flow issues and recapture.
- [x] Compare source and final rendered capture in one full-view and one focused input.
- [x] Test primary intake, review, evidence addition/removal, mapping, source and export paths.
- [x] Check responsive widths, keyboard operation, themes and console errors.
- [x] Leave the local preview open and running.

final result: passed
