const demoCsv = import.meta.glob('../../fixtures/provider-demo/*.csv', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

export function demoFiles(): File[] {
  return Object.entries(demoCsv).map(([path, text]) => {
    const name = path.split('/').pop() ?? 'export.csv'
    return new File([text], name, { type: 'text/csv' })
  })
}

export const DEMO_PERIOD = { from: '2026-01-01', to: '2026-03-31' }
export const DEMO_PROVIDER = 'PROV-DEMO-001'
