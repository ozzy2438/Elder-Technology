import { useState } from 'react'
import type { ParsedTable, SourceClass } from '../engine/types.ts'
import type { MappingOverride } from '../engine/parse.ts'
import type { JurisdictionPack } from '../engine/pack.ts'
import { dateLabel, humanField, sourceLabels } from './presentation.ts'
import { ArrowRightIcon, CaretDownIcon, WarningCircleIcon, CheckIcon } from './icons.ts'
export function Intake({
  tables,
  pack,
  busy,
  onApply,
  onContinue,
  onBack,
}: {
  tables: ParsedTable[]
  pack: JurisdictionPack
  busy: boolean
  onApply: (source: string, mapping: MappingOverride) => Promise<boolean>
  onContinue: () => void
  onBack: () => void
}) {
  const [dirtySources, setDirtySources] = useState<string[]>([])
  const unknown = tables.filter((t) => t.source_class === 'unknown').length
  const issues = tables.reduce((n, t) => n + t.issues.length + t.unmapped_required.length, 0)
  return (
    <main id="main" className="intake-page">
      <p className="eyebrow">Step 2 of 3</p>
      <h1>Check your exports</h1>
      <p className="page-description">
        Confirm what each file contains before reviewing the evidence.
      </p>
      <div className="intake-summary">
        <span>
          {tables.length} tables · {tables.reduce((n, t) => n + t.rows.length, 0)} records
        </span>
        <span>
          {unknown ? `${unknown} source types to confirm` : 'Source types identified'}
          {issues ? ` · ${issues} field or data issues` : ''}
        </span>
      </div>
      <div className="intake-list">
        {tables.map((table) => (
          <MappingRow
            key={`${table.source_file}:${table.source_class}:${JSON.stringify(table.mapped_fields)}`}
            table={table}
            pack={pack}
            busy={busy}
            onApply={onApply}
            onDirty={(source, dirty) =>
              setDirtySources((prev) =>
                dirty ? [...new Set([...prev, source])] : prev.filter((s) => s !== source),
              )
            }
          />
        ))}
      </div>
      <p className="quiet-note">
        <InfoText /> Names and unmapped free-text fields are excluded. Known name values are
        redacted from imported identifiers. Files stay in this browser session.
      </p>
      {unknown > 0 ? (
        <p className="notice">
          Unidentified tables are excluded from the checks. Confirm their source type, or continue
          with those evidence gaps visible.
        </p>
      ) : null}
      {issues > 0 ? (
        <p className="notice">
          Missing fields and invalid values remain visible gaps. Continuing does not treat them as
          supporting evidence.
        </p>
      ) : null}
      <div className="flow-actions">
        <button className="button secondary" onClick={onBack} disabled={busy}>
          Back to files
        </button>
        <button
          className="button primary"
          onClick={onContinue}
          disabled={busy || dirtySources.length > 0}
        >
          {busy ? 'Preparing review…' : 'Review evidence'}
          <ArrowRightIcon size={20} />
        </button>
      </div>
    </main>
  )
}
function InfoText() {
  return <span className="sr-only">Privacy:</span>
}
function MappingRow({
  table,
  pack,
  busy,
  onApply,
  onDirty,
}: {
  table: ParsedTable
  pack: JurisdictionPack
  busy: boolean
  onApply: (source: string, mapping: MappingOverride) => Promise<boolean>
  onDirty: (source: string, dirty: boolean) => void
}) {
  const [sourceClass, setSourceClass] = useState(table.source_class)
  const [fields, setFields] = useState(table.mapped_fields)
  const [dirty, setDirty] = useState(false)
  const required = sourceClass === 'unknown' ? [] : pack.columns.classFields[sourceClass]
  const optional = Object.keys(pack.columns.synonyms).filter(
    (f) => !required.includes(f) && (/related_|event_id/.test(f) || fields[f]),
  )
  const gaps = table.unmapped_required.length + table.issues.length
  return (
    <details className="mapping-row">
      <summary>
        <span className="mapping-status">
          {gaps || table.source_class === 'unknown' ? (
            <WarningCircleIcon size={22} />
          ) : (
            <CheckIcon size={22} />
          )}
        </span>
        <span className="mapping-name">
          <strong>{table.source_file}</strong>
          <span>
            {sourceLabels[table.source_class]} · {table.rows.length} record
            {table.rows.length === 1 ? '' : 's'}
            {gaps ? ` · ${gaps} issues` : ''}
          </span>
        </span>
        <span className="mapping-date">
          {table.date_min
            ? `${dateLabel(table.date_min)} – ${dateLabel(table.date_max)}`
            : 'Dates not supplied'}
        </span>
        <CaretDownIcon size={20} />
      </summary>
      <div className="mapping-body">
        <label>
          Source type
          <select
            value={sourceClass}
            onChange={(e) => {
              setSourceClass(e.target.value as SourceClass)
              setDirty(true)
              onDirty(table.source_file, true)
            }}
          >
            {Object.entries(sourceLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Match columns to fields. Dates accept YYYY-MM-DD, DD/MM/YYYY and ISO timestamps. Hours are
          converted to minutes.
        </p>
        <div className="field-map">
          {[...required, ...optional].map((field) => (
            <label key={field}>
              {humanField(field)}
              {required.includes(field) ? <span className="sr-only"> (required)</span> : null}
              <select
                aria-label={`${table.source_file}: ${field}`}
                value={fields[field] ?? ''}
                onChange={(e) => {
                  setFields({ ...fields, [field]: e.target.value })
                  setDirty(true)
                  onDirty(table.source_file, true)
                }}
              >
                <option value="">Not supplied</option>
                {table.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              {table.null_rates[field] > 0 ? (
                <small>
                  {Math.round(table.null_rates[field] * table.rows.length)} records have blank
                  values
                </small>
              ) : null}
            </label>
          ))}
        </div>
        {table.issues.length ? (
          <ul className="data-issues">
            {table.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <button
          className="button secondary"
          disabled={!dirty || busy}
          onClick={async () => {
            const applied = await onApply(table.source_file, {
              source_class: sourceClass,
              mapped_fields: fields,
            })
            if (applied) {
              setDirty(false)
              onDirty(table.source_file, false)
            }
          }}
        >
          Apply mapping
        </button>
        {dirty ? (
          <p className="notice" role="status">
            Apply your changes before continuing.
          </p>
        ) : null}
      </div>
    </details>
  )
}
