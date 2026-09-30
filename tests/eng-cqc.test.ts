import { readFileSync } from 'node:fs'
import { File } from 'node:buffer'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { forbiddenHits } from '../src/engine/guards.ts'
import { CQC_RATING_FORBIDDEN } from '../src/jurisdictions/eng-cqc-homecare/pack.ts'
import { positionToHuman } from '../src/engine/report.ts'
import { runAnalysis } from '../src/engine/run.ts'
import type { Finding, Grade } from '../src/engine/types.ts'

const DEMO_DIR = resolve('fixtures/eng-cqc-homecare')
const DEMO_NAMES = [
  'service_users.csv',
  'visits.csv',
  'invoices.csv',
  'care_plans.csv',
  'consent.csv',
  'safeguarding.csv',
  'workers.csv',
  'training.csv',
  'policies.csv',
]

const GRADES: Grade[] = [
  'PRESENT',
  'PARTIAL',
  'STALE',
  'CONTRADICTED',
  'MISSING',
  'NOT_TESTABLE_FROM_DATA',
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

describe('England CQC homecare pack', () => {
  it('grades process extracts with UK headers and does not emit CQC ratings as grades', async () => {
    const position = await runAnalysis({
      provider_ref: 'CQC-DEMO-001',
      period_from: '2026-01-01',
      period_to: '2026-03-31',
      files: filesNamed(DEMO_NAMES),
      generated_at: '2026-09-30T00:00:00.000Z',
      pack_id: 'eng-cqc-homecare',
    })

    expect(position.run.pack_id).toBe('eng-cqc-homecare')
    expect(position.run.corpus_id).toBe('cqc-homecare-v1')
    expect(position.intake.files).toHaveLength(9)
    expect(position.intake.files.some((f) => f.source_class === 'billing')).toBe(true)
    expect(position.intake.files.some((f) => f.source_class === 'service_delivery')).toBe(true)
    expect(position.intake.files.some((f) => f.name_fields_stripped.length > 0)).toBe(true)

    const invoices = finding(position.findings, 'CC-CQC-VISIT-UNMATCHED-INVOICES')
    expect(invoices.grade).toBe('PARTIAL')
    expect(invoices.exposure).toBe('HIGH')
    expect(invoices.exceptions.map((e) => e.ref)).toContain('INV-102')

    const visits = finding(position.findings, 'CC-CQC-VISIT-UNMATCHED-VISITS')
    expect(visits.grade).toBe('PARTIAL')
    expect(visits.exceptions.some((e) => e.ref === 'V-003')).toBe(true)

    const duration = finding(position.findings, 'CC-CQC-VISIT-DURATION')
    expect(duration.grade).toBe('PARTIAL')
    expect(duration.exceptions[0].ref).toBe('INV-101')

    const consent = finding(position.findings, 'CC-CQC-CONSENT-LINK')
    expect(consent.grade).toBe('PARTIAL')
    expect(consent.exceptions[0].ref).toContain('SU-001')
    expect(consent.exceptions[0].ref).toContain('change')

    const staff = finding(position.findings, 'CC-CQC-STAFF-ON-DATE')
    expect(staff.grade).toBe('PARTIAL')
    expect(staff.exceptions[0].reason).toMatch(/expired/i)

    const safeguarding = finding(position.findings, 'CC-CQC-SAFEGUARDING-LIFECYCLE')
    expect(safeguarding.grade).toBe('PARTIAL')
    expect(safeguarding.exceptions[0].ref).toBe('SAF-01')

    const needs = finding(position.findings, 'CC-CQC-NEEDS-INTERNAL')
    expect(needs.grade).toBe('CONTRADICTED')
    expect(needs.exceptions[0].reason).toMatch(/BAND-4/)
    expect(needs.exceptions[0].reason).toMatch(/BAND-2/)

    expect(finding(position.findings, 'CC-CQC-EXPERIENCE').grade).toBe('NOT_TESTABLE_FROM_DATA')
    expect(finding(position.findings, 'CC-CQC-OBSERVATION').grade).toBe('NOT_TESTABLE_FROM_DATA')
    expect(finding(position.findings, 'CC-CQC-PLAN-INTERVAL').grade).toBe('NOT_TESTABLE_FROM_DATA')
    expect(finding(position.findings, 'CC-CQC-NEEDS-OFFICIAL-MAP').grade).toBe(
      'NOT_TESTABLE_FROM_DATA',
    )

    for (const row of position.findings) {
      expect(GRADES, row.id).toContain(row.grade)
      expect(row.grade.toLowerCase()).not.toMatch(/outstanding|inadequate|requires improvement/)
    }

    const blob = JSON.stringify(position)
    expect(forbiddenHits(blob)).toEqual([])
    expect(forbiddenHits(blob, CQC_RATING_FORBIDDEN)).toEqual([])
    expect(blob).not.toMatch(/%/)
    expect(blob).not.toMatch(/Jane Example|Alan Example|Priya Example|Mary Smith|John Jones/)
    expect(blob.toLowerCase()).not.toContain('compliant')
    expect(blob.toLowerCase()).not.toMatch(/inspection-ready|survey-ready/)
    expect(blob).toMatch(/Regulation 11/)
    expect(blob).toMatch(/All observation is carried out on site/)

    const human = positionToHuman(position)
    expect(human.lead).toHaveLength(5)
    expect(human.lead[0].id).toBe('CC-CQC-VISIT-UNMATCHED-INVOICES')
    const consentLead = human.lead.find((l) => l.id === 'CC-CQC-CONSENT-LINK')
    expect(consentLead?.sentence).toMatch(/care_plans\.csv:row:3/)
    expect(consentLead?.sentence).toMatch(/2026-03-01/)
  })

  it('marks invoice reconciliation unassessable when invoices are absent', async () => {
    const position = await runAnalysis({
      provider_ref: 'CQC-DEMO-001',
      period_from: '2026-01-01',
      period_to: '2026-03-31',
      files: filesNamed(DEMO_NAMES.filter((n) => n !== 'invoices.csv')),
      generated_at: '2026-09-30T00:00:00.000Z',
      pack_id: 'eng-cqc-homecare',
    })
    expect(
      position.intake.unassessable_requirements.some(
        (u) => u.claim_id === 'CC-CQC-VISIT-UNMATCHED-INVOICES',
      ),
    ).toBe(true)
    expect(finding(position.findings, 'CC-CQC-VISIT-UNMATCHED-INVOICES').grade).toBe(
      'NOT_TESTABLE_FROM_DATA',
    )
  })
})
