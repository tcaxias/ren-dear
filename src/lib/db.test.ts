import { describe, it, expect } from 'vitest'
import { dateKeyFor, isFresh, DEFAULT_TTL_DAYS } from './db.js'
import { ENDPOINTS } from './api.js'

const daily = ENDPOINTS.find((e) => e.id === 'elec-balance-daily')!
const monthly = ENDPOINTS.find((e) => e.id === 'elec-installed-yearly')!

describe('dateKeyFor', () => {
  it('daily endpoint returns the date', () => {
    expect(dateKeyFor(daily, { date: '2024-01-15' })).toBe('2024-01-15')
  })

  it('monthly endpoint returns the year-month', () => {
    expect(dateKeyFor(monthly, { year: 2024, month: 1 })).toBe('2024-01')
  })

  it('falls back to date when granularity fields are missing', () => {
    expect(dateKeyFor(monthly, { date: '2024-03-10' })).toBe('2024-03-10')
  })
})

describe('isFresh', () => {
  it('fresh entry is within TTL', () => {
    expect(isFresh(Date.now(), 1)).toBe(true)
  })

  it('entry older than TTL is stale', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    expect(isFresh(twoDaysAgo, 1)).toBe(false)
  })

  it('Infinity TTL never expires', () => {
    expect(isFresh(0, DEFAULT_TTL_DAYS)).toBe(true)
    expect(isFresh(0, Infinity)).toBe(true)
  })
})
