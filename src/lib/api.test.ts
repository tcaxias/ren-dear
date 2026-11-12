import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildUrl, fetchRen, ENDPOINTS, ApiError, isNetworkError } from './api.js'

const ep = ENDPOINTS.find((e) => e.id === 'elec-balance-daily')!

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn() as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('buildUrl', () => {
  it('builds a daily URL with culture + date', () => {
    const url = buildUrl(ep, { date: '2024-01-15' }, 'pt-PT')
    expect(url.origin).toBe('https://ren-dear-proxy.tcx.workers.dev')
    expect(url.searchParams.get('culture')).toBe('pt-PT')
    expect(url.searchParams.get('date')).toBe('2024-01-15')
    expect(url.pathname).toContain('eletricidade/balanco/diario')
  })

  it('ignores params the endpoint does not request (daily sends no year/month)', () => {
    const url = buildUrl(ep, { date: '2024-01-15', year: 2024, month: 1 }, 'en-US')
    expect(url.searchParams.get('culture')).toBe('en-US')
    expect(url.searchParams.get('date')).toBe('2024-01-15')
    expect(url.searchParams.get('year')).toBeNull()
    expect(url.searchParams.get('month')).toBeNull()
  })
})

describe('fetchRen', () => {
  it('returns parsed JSON on a 200 response', async () => {
    const body = [{ daily_Accumulation: 42, type: 'X' }]
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    )
    const res = await fetchRen(ep, { date: '2024-01-15' }, 'pt-PT')
    expect(res).toEqual(body)
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
  })

  it('throws ApiError for a 4xx without retrying', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('bad', { status: 400 }))
    await expect(fetchRen(ep, { date: '2024-01-15' }, 'pt-PT')).rejects.toBeInstanceOf(ApiError)
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
  })

  it('retries on network failure then throws', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('failed to fetch'))
    await expect(fetchRen(ep, { date: '2024-01-15' }, 'pt-PT', { retries: 1 })).rejects.toBeInstanceOf(TypeError)
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2)
  })

  it('isNetworkError detects failed-to-fetch', () => {
    expect(isNetworkError(new TypeError('failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('boom'))).toBe(false)
    expect(isNetworkError(new ApiError('x', 400, 'e'))).toBe(false)
  })
})
