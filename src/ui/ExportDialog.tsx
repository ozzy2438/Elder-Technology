import { useState } from 'react'
import { Dialog } from './Dialog.tsx'
import { CheckIcon, DownloadSimpleIcon } from './icons.ts'
import type { EvidencePosition } from '../engine/types.ts'
import { reportText } from './presentation.ts'
export function ExportDialog({
  position,
  initialType,
  onClose,
  onDownload,
}: {
  position: EvidencePosition
  initialType: 'json' | 'txt'
  onClose: () => void
  onDownload: (type: 'json' | 'txt') => void
}) {
  const [type, setType] = useState(initialType)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const content = type === 'json' ? JSON.stringify(position, null, 2) : reportText(position)
  async function copy() {
    setError('')
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
    } catch {
      setError(
        'Clipboard access is unavailable. Select the report below and copy it using your keyboard.',
      )
    }
  }
  return (
    <Dialog title="Export review" onClose={onClose} wide>
      <p className="dialog-intro">
        Review the report before saving or sharing it. It contains mapped record identifiers and
        evidence gaps.
      </p>
      <label>
        Report format
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as 'json' | 'txt')
            setCopied(false)
            setError('')
          }}
        >
          <option value="txt">Readable report (.txt)</option>
          <option value="json">Structured data (.json)</option>
        </select>
      </label>
      <textarea className="export-preview" aria-label="Report content" readOnly value={content} />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {copied ? (
        <p className="copy-status" role="status">
          <CheckIcon size={18} />
          Report copied to clipboard.
        </p>
      ) : null}
      <div className="dialog-actions">
        <button className="button secondary" onClick={() => onDownload(type)}>
          <DownloadSimpleIcon size={18} />
          Download {type.toUpperCase()}
        </button>
        <button className="button primary" onClick={() => void copy()}>
          {copied ? 'Copy again' : 'Copy report'}
        </button>
      </div>
      <p className="quiet-note export-note">
        Downloads use your browser’s save behaviour. The report is also available here to copy. No
        records are stored on a server.
      </p>
    </Dialog>
  )
}
