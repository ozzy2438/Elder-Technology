export function PaperStack() {
  return (
    <div className="depth" aria-hidden="true">
      <span className="sheet s1" />
      <span className="sheet s2" />
      <span className="sheet s3">
        <span className="sheet-rule" />
        <span className="sheet-rule short" />
      </span>
    </div>
  )
}
