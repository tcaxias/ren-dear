import { describe, it, expect } from 'vitest'
import { DataStore, type Row } from './data.js'

const row = (overrides: Partial<Row> = {}): Row => ({
  date: '2024-01-01',
  endpoint: 'elec-balance-daily',
  type: 'X',
  value: 1,
  ...overrides,
})

describe('DataStore', () => {
  it('set replaces the dataset', () => {
    const store = new DataStore()
    store.set([row(), row({ date: '2024-01-02', value: 5 })])
    expect(store.snapshot.rows).toHaveLength(2)
    expect(store.snapshot.loading).toBe(false)
    expect(store.snapshot.error).toBeNull()
  })

  it('merge dedupes by date + endpoint + type', () => {
    const store = new DataStore()
    store.set([row({ value: 1 })])
    store.merge([row({ value: 9 }), row({ date: '2024-01-02', value: 2 })])
    const rows = store.snapshot.rows
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.date === '2024-01-01')?.value).toBe(9)
  })

  it('filter by endpoint and type', () => {
    const store = new DataStore()
    store.set([
      row({ endpoint: 'A', type: 't1' }),
      row({ endpoint: 'A', type: 't2' }),
      row({ endpoint: 'B', type: 't1' }),
    ])
    expect(store.filter('A', 't1')).toHaveLength(1)
    expect(store.filter('A')).toHaveLength(2)
    expect(store.filter(undefined, 't1')).toHaveLength(2)
  })

  it('endpoints / typesFor / dates', () => {
    const store = new DataStore()
    store.set([
      row({ endpoint: 'A', type: 't1', date: '2024-01-01' }),
      row({ endpoint: 'A', type: 't2', date: '2024-01-02' }),
      row({ endpoint: 'B', type: 't1', date: '2024-01-01' }),
    ])
    expect(store.endpoints().sort()).toEqual(['A', 'B'])
    expect(store.typesFor('A').sort()).toEqual(['t1', 't2'])
    expect(store.dates()).toEqual(['2024-01-01', '2024-01-02'])
  })

  it('clear empties the dataset', () => {
    const store = new DataStore()
    store.set([row()])
    store.clear()
    expect(store.snapshot.rows).toHaveLength(0)
  })
})
