import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from './icons.ts'
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    el?.showModal()
    return () => {
      el?.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'wide' : ''}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}>
          <XIcon size={22} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
