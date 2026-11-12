import { describe, it, expect } from 'vitest'
import { expandRange, CONCURRENCY } from './orchestrate.js'
import { ENDPOINTS } from './api.js'

const daily = ENDPOINTS.find((e) => e.id === 'elec-balance-daily')!
const monthly = ENDPOINTS.find((e) => e.id === 'elec-installed-yearly')!

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d))
}

describe('expandRange', () => {
  it('expands daily into one task per calendar day (UTC)', () => {
    const tasks = expandRange(daily, utc(2024, 0, 1), utc(2024, 0, 3))
    expect(tasks).toEqual([
      { date: '2024-01-01' },
      { date: '2024-01-02' },
      { date: '2024-01-03' },
    ])
  })

  it('expands monthly into one task per month', () => {
    const tasks = expandRange(monthly, utc(2024, 0, 1), utc(2024, 2, 1))
    expect(tasks).toEqual([
      { year: 2024, month: 1 },
      { year: 2024, month: 2 },
      { year: 2024, month: 3 },
    ])
  })

  it('returns an empty list when from is after to', () => {
    const tasks = expandRange(daily, utc(2024, 0, 5), utc(2024, 0, 1))
    expect(tasks).toEqual([])
  })
})

describe('CONCURRENCY', () => {
  it('is a small positive number', () => {
    expect(CONCURRENCY).toBeGreaterThan(0)
    expect(CONCURRENCY).toBeLessThanOrEqual(5)
  })
})
