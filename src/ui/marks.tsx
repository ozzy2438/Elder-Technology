import type { Exposure, Grade } from '../engine/types.ts'

export function ExposureMark({ value }: { value: Exposure }) {
  return (
    <span className={`mark mark-exp mark-${value.toLowerCase()}`}>
      <span className="mark-k">Exposure</span>
      <span className="mark-v">{value}</span>
    </span>
  )
}

export function GradeMark({ value }: { value: Grade }) {
  return (
    <span className="mark mark-grade">
      <span className="mark-k">Grade</span>
      <span className="mark-v">{value}</span>
    </span>
  )
}
