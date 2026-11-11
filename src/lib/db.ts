/**
 * IndexedDB cache layer (Dexie) for REN DataHub responses.
 *
 * Table `fetches` uses a compound primary key `[endpoint, dateKey]` where
 * `dateKey` is `yyyy-mm-dd` (daily), `yyyy-mm` (monthly) or `yyyy` (yearly).
 * Each row stores the payload plus `fetchedAt` so callers can apply a TTL.
 *
 * All data stays in the browser. No backend.
 */

import Dexie, { type Table } from 'dexie'
import type { DateParams, Endpoint, RenRecord } from './api.js'

export interface CachedFetch {
  endpoint: string
  dateKey: string
  payload: RenRecord[]
  fetchedAt: number // epoch ms
  params?: DateParams
}

export interface TaggedRows {
  dateKey: string
  rows: RenRecord[] // each row tagged with dateKey by the consumer
}

/** Default history cap (years) applied to range selection. */
export const DEFAULT_HISTORY_CAP_YEARS = 2

/** Default TTL: entries older than this many days are considered stale.
 * `Infinity` means cache hits never expire by age — good for resume-on-reload.
 * Callers can pass a smaller ttlDays to `getOrFetch` to opt into refetching. */
export const DEFAULT_TTL_DAYS = Infinity

export class RenDb extends Dexie {
  fetches!: Table<CachedFetch, [string, string]> // compound PK [endpoint, dateKey]

  constructor() {
    super('ren-dear')
    this.version(1).stores({
      fetches: '[endpoint+dateKey]',
    })
  }
}

export const db = new RenDb()

/** Derive a sortable dateKey from date params based on endpoint granularity. */
export function dateKeyFor(endpoint: Endpoint, params: DateParams): string {
  if (endpoint.granularity === 'daily' && params.date) {
    return params.date // yyyy-mm-dd
  }
  if (endpoint.granularity === 'monthly' && params.year && params.month) {
    return `${params.year}-${String(params.month).padStart(2, '0')}` // yyyy-mm
  }
  if (endpoint.granularity === 'yearly' && params.year) {
    return String(params.year) // yyyy
  }
  // Fallback: best effort from whatever is present.
  if (params.date) return params.date
  if (params.year && params.month)
    return `${params.year}-${String(params.month).padStart(2, '0')}`
  if (params.year) return String(params.year)
  return ''
}

/** Is a cached entry still fresh under the given TTL? */
export function isFresh(
  fetchedAt: number,
  ttlDays: number = DEFAULT_TTL_DAYS,
): boolean {
  if (ttlDays === Infinity) return true
  const ageMs = Date.now() - fetchedAt
  return ageMs <= ttlDays * 24 * 60 * 60 * 1000
}

/**
 * Cache-aware fetch.
 *
 * - Cache hit (fresh): return cached payload.
 * - Miss or stale: fetch via `fetchFn`, store the result, return it.
 *
 * `fetchFn` should call the API client. Returns the payload (untagged — the
 * caller tags rows with dateKey before rendering).
 */
export async function getOrFetch(
  endpoint: Endpoint,
  params: DateParams,
  fetchFn: () => Promise<RenRecord[]>,
  { ttlDays = DEFAULT_TTL_DAYS }: { ttlDays?: number } = {},
): Promise<RenRecord[]> {
  const dateKey = dateKeyFor(endpoint, params)

  const cached = await db.fetches.get([endpoint.id, dateKey])
  if (cached && isFresh(cached.fetchedAt, ttlDays)) {
    return cached.payload
  }

  const payload = await fetchFn()

  await db.fetches.put({
    endpoint: endpoint.id,
    dateKey,
    payload,
    fetchedAt: Date.now(),
    params,
  })

  return payload
}

/** Fetch a range of dates for one endpoint, returning per-date results. */
export async function fetchRange(
  endpoint: Endpoint,
  paramsList: DateParams[],
  fetchFn: (params: DateParams) => Promise<RenRecord[]>,
  options: { ttlDays?: number } = {},
): Promise<Array<{ params: DateParams; dateKey: string; rows: RenRecord[] }>> {
  const results = []
  for (const params of paramsList) {
    const rows = await getOrFetch(endpoint, params, () => fetchFn(params), options)
    results.push({ params, dateKey: dateKeyFor(endpoint, params), rows })
  }
  return results
}

/** Remove all cached rows (useful for tests / reset). */
export async function clearCache(): Promise<void> {
  await db.fetches.clear()
}

/** Count of cached rows. */
export async function countCache(): Promise<number> {
  return db.fetches.count()
}
