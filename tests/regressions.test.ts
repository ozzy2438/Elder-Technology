import { readFileSync } from 'node:fs'
import { File } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { runAnalysis, prepareIntake, analysePrepared, type RunInput } from '../src/engine/run.ts'
import { parseDate, parseTemporal, compareTemporal } from '../src/engine/dates.ts'
import { parseSourceFile } from '../src/engine/parse.ts'
import { redactObject } from '../src/engine/redact.ts'
import { auSahColumns } from '../src/jurisdictions/au-sah/columns.ts'

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' })
const delivery = (body = 'D1,P1,2026-03-11,60,W1,personal_care') =>
  csv(
    'delivery.csv',
    `record_id,participant_id,service_date,duration_minutes,worker_id,service_type\n${body}`,
  )
const billing = (body = 'C1,P1,2026-03-11,60,W1,personal_care,120') =>
  csv(
    'billing.csv',
    `claim_id,participant_id,claim_date,duration_minutes,worker_id,service_type,amount\n${body}`,
  )
const competency = (to = '2026-12-31') =>
  csv(
    'competency.csv',
    `worker_id,service_type,competency,valid_from,valid_to\nW1,personal_care,care_certificate,2026-01-01,${to}`,
  )
const policy = csv(
  'policies.csv',
  'policy_id,policy_name,topic,version,approved_at,review_due\nPOL1,Incident process,incidents,1,2026-01-01,2027-01-01',
)
const base = {
  provider_ref: 'PROV-TEST',
  period_from: '2026-01-01',
  period_to: '2026-03-31',
  generated_at: '2026-09-30T00:00:00Z',
}
const run = (files: File[], extra: Partial<RunInput> = {}) =>
  runAnalysis({ ...base, files, ...extra })
const get = (result: Awaited<ReturnType<typeof run>>, id: string) =>
  result.findings.find((f) => f.id === id)!

function incident(
  recorded: string,
  actioned: string,
  closed: string,
  notified = '',
  notify = 'false',
  extraHeader = '',
  extraValues = '',
) {
  return csv(
    'incidents.csv',
    `incident_id,participant_id,recorded_at,actioned_at,closed_at,notified_at,severity,notify_required${extraHeader}\nI1,P1,${recorded},${actioned},${closed},${notified},high,${notify}${extraValues}`,
  )
}

describe('regressions from the independent review', () => {
  it('exports all-success billing and competency findings with actual source pointers', async () => {
    const result = await run([delivery(), billing(), competency()])
    for (const id of [
      'CC-BILL-UNMATCHED-CLAIMS',
      'CC-BILL-UNMATCHED-DELIVERIES',
      'CC-BILL-DURATION',
      'CC-COMP-ON-DATE',
    ]) {
      expect(get(result, id).grade).toBe('PRESENT')
      expect(
        get(result, id).evidence.some(
          (p) => p.locator.includes(':row:2') && p.date === '2026-03-11',
        ),
      ).toBe(true)
    }
    expect(get(result, 'CC-BILL-DURATION').evidence).toHaveLength(2)
  })
  it('retains ISO time/offsets and catches reversed same-day incident sequences', async () => {
    const result = await run([
      incident(
        '2026-03-01T15:00:00+11:00',
        '2026-03-01T09:00:00+11:00',
        '2026-03-01T08:00:00+11:00',
        '2026-03-01T07:00:00+11:00',
        'true',
      ),
    ])
    const f = get(result, 'CC-INCIDENT-LIFECYCLE')
    expect(f.grade).toBe('MISSING')
    expect(f.evidence[0].date).toBe('2026-03-01T15:00:00+11:00')
    expect(f.exceptions[0].reason).toMatch(/actioned_at before recorded_at/)
    expect(f.exceptions[0].reason).toMatch(/notified_at before recorded_at/)
  })
  it('does not reuse unlinked old consent for two later plan changes', async () => {
    const plans = csv(
      'plans.csv',
      'participant_id,plan_id,event_type,event_date,is_material,classification,review_date\nP1,CP-A,change,2026-02-01,true,SH-1,\nP1,CP-B,change,2026-03-01,true,SH-1,',
    )
    const consent = csv(
      'consent.csv',
      'consent_id,participant_id,related_plan_id,consent_type,consent_date\nCO1,P1,,change,2025-01-01',
    )
    expect(get(await run([plans, consent]), 'CC-CONSENT-LINK').coverage).toEqual({
      assessed: 2,
      satisfied: 0,
    })
  })
  it('accepts earlier consent only when explicitly linked to the specific plan event', async () => {
    const plans = csv(
      'plans.csv',
      'participant_id,plan_id,event_id,event_type,event_date,is_material,classification,review_date\nP1,CP1,EV1,change,2026-03-01,true,SH-1,',
    )
    const consent = csv(
      'consent.csv',
      'consent_id,participant_id,related_plan_id,related_event_id,consent_type,consent_date\nCO1,P1,CP1,EV1,change,2026-02-28',
    )
    expect(get(await run([plans, consent]), 'CC-CONSENT-LINK').grade).toBe('PRESENT')
  })
  it('keeps current policy without linked completed practice PARTIAL', async () => {
    const result = await run([policy, incident('2026-03-01', '2026-03-02', '')])
    const f = get(result, 'CC-POLICY-ENACTMENT')
    expect(f.grade).toBe('PARTIAL')
    expect(f.coverage).toEqual({ assessed: 1, satisfied: 0 })
  })
  it('checks the content of explicitly linked practice, not table presence', async () => {
    const extra = [',related_policy_id,related_policy_version', ',POL1,1']
    const complete = get(
      await run([
        policy,
        incident('2026-03-01', '2026-03-02', '2026-03-03', '', 'false', ...extra),
      ]),
      'CC-POLICY-ENACTMENT',
    )
    expect(complete.grade).toBe('PRESENT')
    expect(complete.evidence.some((p) => p.source_file === 'incidents.csv')).toBe(true)
    expect(
      get(
        await run([policy, incident('2026-03-01', '2026-03-02', '', '', 'false', ...extra)]),
        'CC-POLICY-ENACTMENT',
      ).grade,
    ).toBe('PARTIAL')
  })
  it('limits activity checks to the selected period and gives no success for zero activity', async () => {
    const result = await run(
      [delivery(), billing(), competency(), incident('2026-03-01', '2026-03-02', '2026-03-03')],
      { period_from: '2026-04-01', period_to: '2026-04-30' },
    )
    for (const id of [
      'CC-BILL-UNMATCHED-CLAIMS',
      'CC-BILL-DURATION',
      'CC-COMP-ON-DATE',
      'CC-INCIDENT-LIFECYCLE',
    ]) {
      expect(get(result, id).grade).toBe('NOT_TESTABLE_FROM_DATA')
      expect(get(result, id).coverage.assessed).toBe(0)
      expect(get(result, id).evidence[0].source_file).toBe('(intake)')
    }
  })
})

describe('intake and conservative boundaries', () => {
  it('does not choose a matching visit when duplicate keys make a pair ambiguous', async () => {
    const result = await run([
      delivery('D1,P1,2026-03-11,60,W1,personal_care\nD2,P1,2026-03-11,60,W1,personal_care'),
      billing(),
    ])
    expect(get(result, 'CC-BILL-UNMATCHED-CLAIMS').coverage.satisfied).toBe(0)
    expect(get(result, 'CC-BILL-UNMATCHED-CLAIMS').exceptions[0].reason).toMatch(/More than one/)
    expect(result.open_questions.some((q) => q.id.startsWith('pair-'))).toBe(true)
  })
  it('does not pick the first claim when two explicit links target the same delivery', async () => {
    const claims = csv(
      'billing.csv',
      'claim_id,participant_id,claim_date,duration_minutes,worker_id,service_type,amount,related_record_id\nC1,P1,2026-03-11,60,W1,personal_care,120,D1\nC2,P1,2026-03-11,60,W1,personal_care,120,D1',
    )
    const f = get(await run([delivery(), claims]), 'CC-BILL-UNMATCHED-CLAIMS')
    expect(f.coverage).toEqual({ assessed: 2, satisfied: 0 })
  })
  it('redacts quoted and case-varied known names as decoded strings', () => {
    const value = { note: 'anne "example"', nested: ['Anne "Example"'] }
    expect(redactObject(value, ['Anne "Example"'])).toEqual({
      note: '[name-redacted]',
      nested: ['[name-redacted]'],
    })
  })
  it('normalises hours for each source table and preserves fractional minutes', async () => {
    const bill = csv(
      'billing.csv',
      'claim_id,participant_id,claim_date,hours,worker_id,service_type,amount\nC1,P1,2026-03-11,1.005,W1,personal_care,120',
    )
    const result = await run([delivery('D1,P1,2026-03-11,60.3,W1,personal_care'), bill])
    expect(get(result, 'CC-BILL-DURATION').grade).toBe('PRESENT')
  })
  it('does not select the first of two ambiguous duration aliases', async () => {
    const file = csv(
      'billing.csv',
      'claim_id,participant_id,claim_date,hours,minutes,worker_id,service_type,amount\nC1,P1,2026-03-11,1,60,W1,personal_care,120',
    )
    const prepared = await prepareIntake({ ...base, files: [file] })
    expect(prepared.tables[0].unmapped_required).toContain('duration_minutes')
    const mapped = await prepareIntake({
      ...base,
      files: [file, delivery()],
      mappings: {
        'billing.csv': {
          source_class: 'billing',
          mapped_fields: { ...prepared.tables[0].mapped_fields, duration_minutes: 'hours' },
        },
      },
    })
    expect(
      get(analysePrepared({ ...base, files: [file, delivery()] }, mapped), 'CC-BILL-DURATION')
        .grade,
    ).toBe('PRESENT')
  })
  it('handles every XLSX sheet using the installed reader API', async () => {
    const file = new File([readFileSync('fixtures/regressions/multi-sheet.xlsx')], 'exports.xlsx')
    const tables = await parseSourceFile(file, auSahColumns)
    expect(tables.map((t) => t.source_class)).toEqual(['billing', 'service_delivery'])
    expect(tables[0].source_file).toBe('exports.xlsx [Claims]')
    expect(tables[1].rows[0].locator).toBe('exports.xlsx [Visits]:row:2')
    expect(get(await run([file]), 'CC-BILL-DURATION').grade).toBe('PRESENT')
  })
  it('rejects malformed CSV, duplicate columns, unsupported XLS, and invalid run periods', async () => {
    await expect(run([csv('bad.csv', 'worker_id,worker_id\nW1,W2')])).rejects.toThrow(/duplicate/)
    await expect(run([csv('bad.csv', 'worker_id,role\n"unclosed,role')])).rejects.toThrow()
    await expect(run([csv('bad.xls', 'not a workbook')])).rejects.toThrow(/legacy XLS/)
    await expect(run([delivery()], { period_from: '2026-02-30' })).rejects.toThrow(/valid start/)
    await expect(run([delivery()], { period_from: '2026-04-01' })).rejects.toThrow(/end date/)
  })
  it('keeps invalid dates visible as record gaps and intake issues', async () => {
    const result = await run([
      delivery('D1,P1,2026-02-30,60,W1,personal_care'),
      billing(),
      competency(),
    ])
    expect(result.intake.files.find((f) => f.source_file === 'delivery.csv')?.issues).toHaveLength(
      1,
    )
    expect(get(result, 'CC-COMP-ON-DATE').coverage).toEqual({ assessed: 1, satisfied: 0 })
  })
  it('does not infer notification obligation from high severity', async () => {
    const result = await run([incident('2026-03-01', '2026-03-02', '2026-03-03', '', '')])
    expect(get(result, 'CC-INCIDENT-LIFECYCLE').grade).toBe('MISSING')
    expect(get(result, 'CC-INCIDENT-LIFECYCLE').exceptions[0].reason).toMatch(/unknown/)
  })
  it('does not establish a same-day sequence from mixed timestamp precision', async () => {
    const result = await run([incident('2026-03-01T15:00:00Z', '2026-03-01', '2026-03-02')])
    expect(get(result, 'CC-INCIDENT-LIFECYCLE').exceptions[0].reason).toMatch(/precision/)
  })
  it('does not call missing competency expiry current', async () => {
    expect(get(await run([delivery(), competency('')]), 'CC-COMP-ON-DATE').grade).toBe('MISSING')
  })
  it('retains participants with missing classification/plan in the denominator and ignores future plans', async () => {
    const participants = csv(
      'participants.csv',
      'participant_id,classification,budget_code,start_date\nP1,SH-1,B1,2025-01-01\nP2,,B2,2025-01-01',
    )
    const plans = csv(
      'plans.csv',
      'participant_id,plan_id,event_type,event_date,is_material,classification,review_date\nP1,CP1,create,2026-01-01,false,SH-1,\nP1,CP1,change,2026-05-01,true,SH-4,',
    )
    const f = get(await run([participants, plans]), 'CC-CLASS-INTERNAL')
    expect(f.grade).toBe('PARTIAL')
    expect(f.coverage).toEqual({ assessed: 2, satisfied: 1 })
  })
  it('rejects future approval as policy currency', async () => {
    const policies = csv(
      'policies.csv',
      'policy_id,policy_name,topic,version,approved_at,review_due\nP1,Future policy,incidents,1,2026-05-01,2027-01-01',
    )
    expect(get(await run([policies]), 'CC-POLICY-CURRENCY').grade).toBe('MISSING')
  })
  it('excludes free text and strips names before a record can be viewed', async () => {
    const file = csv(
      'delivery.csv',
      'record_id,participant_id,participant_name,service_date,duration_minutes,worker_id,service_type,notes\nD1,Jane Example,Jane Example,2026-03-11,60,W1,personal_care,private clinical note',
    )
    const prepared = await prepareIntake({ ...base, files: [file] })
    expect(JSON.stringify(prepared.tables[0].rows)).not.toMatch(
      /Jane Example|private clinical note/,
    )
    expect(prepared.tables[0].rows[0].values.participant_id).toBe('[name-redacted]')
  })
  it('preserves literal percentages in source extracts without emitting a percentage score', async () => {
    const policies = csv(
      'policies.csv',
      'policy_id,policy_name,topic,version,approved_at,review_due\nP1,Source label,incidents,100%,2026-01-01,2027-01-01',
    )
    expect(get(await run([policies]), 'CC-POLICY-CURRENCY').evidence[0].extract).toContain('100%')
  })
  it('validates leap days and compares timezone offsets as instants', () => {
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('29/02/2024')).toBe('2024-02-29')
    expect(parseTemporal('2026-03-01T25:00:00Z')).toBeNull()
    expect(compareTemporal('2026-03-01T12:00:00+11:00', '2026-03-01T01:30:00Z')).toBe(-1)
  })
})
