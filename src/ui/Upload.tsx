import { useRef, useState } from 'react'
import { Dialog } from './Dialog.tsx'
import {
  FileTextIcon,
  PlusIcon,
  XIcon,
  UploadSimpleIcon,
  ArrowRightIcon,
  CircleNotchIcon,
} from './icons.ts'
export function Upload({
  files,
  provider,
  from,
  to,
  busy,
  error,
  onFiles,
  onProvider,
  onFrom,
  onTo,
  onClose,
  onContinue,
}: {
  files: File[]
  provider: string
  from: string
  to: string
  busy: boolean
  error: string | null
  onFiles: (files: File[]) => void
  onProvider: (v: string) => void
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onClose: () => void
  onContinue: () => void
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  function addFiles(next: File[]) {
    const updated = new Map(files.map((f) => [f.name, f]))
    for (const file of next) updated.set(file.name, file)
    onFiles([...updated.values()])
  }
  return (
    <Dialog
      title="Add exports"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onContinue()
        }}
      >
        <p className="dialog-intro">
          Add your CSV or XLSX exports. Review the file mapping before any evidence checks run.
        </p>
        <label>
          Provider reference
          <input
            autoComplete="off"
            placeholder="e.g. PROV-001"
            value={provider}
            onChange={(e) => onProvider(e.target.value)}
            required
            disabled={busy}
          />
          <small>Use an identifier, not a person’s name.</small>
        </label>
        <div className="date-inputs">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => onTo(e.target.value)}
              required
              disabled={busy}
            />
          </label>
        </div>
        <input
          ref={picker}
          type="file"
          multiple
          accept=".csv,.xlsx"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose CSV or XLSX files"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={`drop-area ${drag ? 'dragging' : ''}`}
          disabled={busy}
          onClick={() => picker.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            if (!busy) addFiles(Array.from(e.dataTransfer.files))
          }}
        >
          <UploadSimpleIcon size={30} weight="light" />
          <strong>Choose files or drop them here</strong>
          <span>CSV and XLSX · multiple files supported</span>
        </button>
        {files.length ? (
          <div className="upload-files" aria-label="Selected files">
            {files.map((f) => (
              <div className="upload-file" key={f.name}>
                <FileTextIcon size={22} />
                <span>
                  {f.name}
                  <small>{Math.max(1, Math.round(f.size / 1024))} KB</small>
                </span>
                <button
                  className="icon-button"
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onFiles(files.filter((other) => other.name !== f.name))}
                >
                  <XIcon size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              <PlusIcon size={18} /> Add more files
            </button>
          </div>
        ) : null}
        <p className="quiet-note">
          A file with the same name replaces the earlier file. Nothing is uploaded to a server.
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy || !files.length}>
            {busy ? <CircleNotchIcon className="spin" size={20} /> : null}
            {busy ? 'Reading exports…' : 'Check exports'}
            {!busy ? <ArrowRightIcon size={20} /> : null}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
