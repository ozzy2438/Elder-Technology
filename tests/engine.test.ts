import { readFileSync } from 'node:fs'
import { File } from 'node:buffer'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { forbiddenHits } from '../src/engine/guards.ts'
import { positionToHuman } from '../src/engine/report.ts'
import { runAnalysis } from '../src/engine/run.ts'
import type { Finding } from '../src/engine/types.ts'

const DEMO_DIR = resolve('fixtures/provider-demo')
const DEMO_NAMES = [
  'participants.csv',
  'service_delivery.csv',
  'billing.csv',
  'care_plans.csv',
  'consent.csv',
  'incidents.csv',
  'workers.csv',
  'competency.csv',
  'policies.csv',
]

function filesNamed(names: string[]): File[] {
  return names.map((name) => {
    const buf = readFileSync(resolve(DEMO_DIR, name))
    return new File([buf], name, { type: 'text/csv' })
  })
}

function finding(list: Finding[], id: string): Finding {
  const row = list.find((f) => f.id === id)
  if (!row) throw new Error(`missing finding ${id}`)
  return row
}

describe('demo pack evidence position', () => {
  it('runs intake then grades the seven cross-checks with pointers', async () => {
    const position = await runAnalysis({
      provider_ref: 'PROV-DEMO-001',
      period_from: '2026-01-01',
      period_to: '2026-03-31',
      files: filesNamed(DEMO_NAMES),
      generated_at: '2026-09-15T00:00:00.000Z',
    })

    expect(position.intake.files).toHaveLength(9)
    expect(position.intake.unassessable_requirements).toHaveLength(0)
    expect(position.intake.files.some((f) => f.name_fields_stripped.length > 0)).toBe(true)

    const claims = finding(position.findings, 'CC-BILL-UNMATCHED-CLAIMS')
    expect(claims.grade).toBe('PARTIAL')
    expect(claims.exposure).toBe('HIGH')
    expect(claims.coverage).toEqual({ assessed: 3, satisfied: 2 })
    expect(claims.exceptions.map((e) => e.ref)).toContain('C-102')
    expect(claims.exceptions[0].locator).toMatch(/billing\.csv:row:/)

    const deliveries = finding(position.findings, 'CC-BILL-UNMATCHED-DELIVERIES')
    expect(deliveries.grade).toBe('PARTIAL')
    expect(deliveries.exceptions.some((e) => e.ref === 'SD-003')).toBe(true)

    const duration = finding(position.findings, 'CC-BILL-DURATION')
    expect(duration.grade).toBe('PARTIAL')
    expect(duration.exceptions[0].ref).toBe('C-101')

    const consent = finding(position.findings, 'CC-CONSENT-LINK')
    expect(consent.grade).toBe('PARTIAL')
    expect(consent.exposure).toBe('HIGH')
    expect(consent.exceptions[0].ref).toContain('P-001')
    expect(consent.exceptions[0].ref).toContain('change')

    const competency = finding(position.findings, 'CC-COMP-ON-DATE')
    expect(competency.grade).toBe('PARTIAL')
    expect(competency.exposure).toBe('HIGH')
    expect(competency.exceptions[0].reason).toMatch(/expired/i)

    const expiredNow = finding(position.findings, 'CC-COMP-EXPIRED-NOW')
    expect(expiredNow.grade).toBe('PARTIAL')
    expect(expiredNow.exceptions[0].ref).toBe('W-010/domestic_assistance')

    const interval = finding(position.findings, 'CC-CADENCE-INTERVAL')
    expect(interval.grade).toBe('NOT_TESTABLE_FROM_DATA')
    expect(interval.closes_with).toMatch(/interval/i)

    const trigger = finding(position.findings, 'CC-CADENCE-TRIGGER')
    expect(trigger.grade).toBe('PARTIAL')
    expect(trigger.exceptions[0].ref).toBe('INC-01')

    const incidents = finding(position.findings, 'CC-INCIDENT-LIFECYCLE')
    expect(incidents.grade).toBe('PARTIAL')
    expect(incidents.exposure).toBe('HIGH')
    expect(incidents.exceptions[0].ref).toBe('INC-01')
    expect(incidents.exceptions[0].reason).toMatch(/closed_at/)

    const enactment = finding(position.findings, 'CC-POLICY-ENACTMENT')
    expect(enactment.grade).toBe('PARTIAL')
    expect(enactment.exceptions[0].ref).toBe('POL-02')

    const contradicted = finding(position.findings, 'CC-CLASS-INTERNAL')
    expect(contradicted.grade).toBe('CONTRADICTED')
    expect(contradicted.exceptions[0].reason).toMatch(/SH-4/)
    expect(contradicted.exceptions[0].reason).toMatch(/SH-2/)
    expect(contradicted.exceptions[0].reason).toMatch(/neither preferred/)

    const official = finding(position.findings, 'CC-CLASS-OFFICIAL-MAP')
    expect(official.grade).toBe('NOT_TESTABLE_FROM_DATA')

    for (const row of position.findings) {
      const hasPointer =
        row.evidence.length > 0 || row.exceptions.some((ex) => Boolean(ex.locator))
      expect(hasPointer, row.id).toBe(true)
      if (row.grade === 'PARTIAL') {
        expect(row.exceptions.length, row.id).toBeGreaterThan(0)
        expect(row.coverage.satisfied, row.id).toBeLessThan(row.coverage.assessed)
      }
    }

    const blob = JSON.stringify(position)
    expect(forbiddenHits(blob)).toEqual([])
    expect(blob).not.toMatch(/%/)
    expect(blob).not.toMatch(/Alice Example|Bob Example|Carol Example|Mary Smith|John Jones/)
    expect(blob.toLowerCase()).not.toContain('compliant')
    expect(blob.toLowerCase()).not.toMatch(/will pass|will fail/)

    const human = positionToHuman(position)
    expect(human.lead).toHaveLength(5)
    expect(human.lead[0].id).toBe('CC-BILL-UNMATCHED-CLAIMS')
    const consentLead = human.lead.find((l) => l.id === 'CC-CONSENT-LINK')
    expect(consentLead?.sentence).toMatch(/care_plans\.csv:row:3/)
    expect(consentLead?.sentence).toMatch(/2026-03-01/)
    expect(consentLead?.sentence).not.toMatch(/2026-01-15/)

    expect(blob).toMatch(/Strengthened Quality Standards/)
    expect(blob).not.toMatch(/\[name-redacted\]/)
    expect(human.table[0].exposure).toBe('HIGH')
    const firstNonHigh = human.table.findIndex((f) => f.exposure !== 'HIGH')
    const lastHigh = human.table.findLastIndex((f) => f.exposure === 'HIGH')
    expect(lastHigh).toBeLessThan(firstNonHigh === -1 ? human.table.length : firstNonHigh + 1)
    expect(lastHigh).toBeLessThan(firstNonHigh)
  })

  it('marks billing reconciliation unassessable when the billing file is absent', async () => {
    const position = await runAnalysis({
      provider_ref: 'PROV-DEMO-001',
      period_from: '2026-01-01',
      period_to: '2026-03-31',
      files: filesNamed(DEMO_NAMES.filter((n) => n !== 'billing.csv')),
      generated_at: '2026-09-15T00:00:00.000Z',
    })
    expect(
      position.intake.unassessable_requirements.some((u) => u.claim_id === 'CC-BILL-UNMATCHED-CLAIMS'),
    ).toBe(true)
    expect(finding(position.findings, 'CC-BILL-UNMATCHED-CLAIMS').grade).toBe(
      'NOT_TESTABLE_FROM_DATA',
    )
    expect(finding(position.findings, 'CC-BILL-DURATION').grade).toBe('NOT_TESTABLE_FROM_DATA')
  })
})
