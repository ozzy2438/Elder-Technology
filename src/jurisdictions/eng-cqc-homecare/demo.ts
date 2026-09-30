const demoCsv = import.meta.glob('../../../fixtures/eng-cqc-homecare/*.csv', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

export function engCqcDemoFiles(): File[] {
  return Object.entries(demoCsv).map(([path, text]) => {
    const name = path.split('/').pop() ?? 'export.csv'
    return new File([text], name, { type: 'text/csv' })
  })
}

export const ENG_CQC_DEMO_PERIOD = { from: '2026-01-01', to: '2026-03-31' }
export const ENG_CQC_DEMO_PROVIDER = 'CQC-DEMO-001'
