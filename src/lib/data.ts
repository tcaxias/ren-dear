/**
 * Normalized in-memory dataset.
 *
 * Each row: { date, endpoint, type, value }. The `date` is the dateKey
 * (yyyy-mm-dd / yyyy-mm / yyyy) that the API response is tagged with.
 * Kept separate from IndexedDB: the cache stores raw payloads; this store
 * holds the merged, UI-ready rows for the current session.
 */

import { writable, type Writable } from 'svelte/store'

export interface Row {
  date: string
  endpoint: string
  type: string
  value: number
}

export interface DataState {
  rows: Row[]
  error: string | null
  loading: boolean
}

function initialState(): DataState {
  return { rows: [], error: null, loading: false }
}

export class DataStore {
  private state: Writable<DataState>

  constructor() {
    this.state = writable(initialState())
  }

  subscribe(...args: Parameters<Writable<DataState>['subscribe']>) {
    return this.state.subscribe(...args)
  }

  get snapshot(): DataState {
    let current: DataState | undefined
    this.state.subscribe((s) => { current = s })()
    return current!
  }

  /** Replace the whole dataset. */
  set(rows: Row[]): void {
    this.state.set({ rows: this.normalize(rows), error: null, loading: false })
  }

  /** Merge rows, deduping by (date, endpoint, type). */
  merge(rows: Row[]): void {
    this.state.update((s) => {
      const existing = new Map(s.rows.map((r) => [`${r.date}|${r.endpoint}|${r.type}`, r]))
      for (const r of rows) existing.set(`${r.date}|${r.endpoint}|${r.type}`, r)
      return { ...s, rows: [...existing.values()].sort((a, b) => a.date.localeCompare(b.date)) }
    })
  }

  clear(): void {
    this.state.set(initialState())
  }

  setError(message: string): void {
    this.state.update((s) => ({ ...s, error: message, loading: false }))
  }

  setLoading(loading: boolean): void {
    this.state.update((s) => ({ ...s, loading }))
  }

  /** Endpoints present in the data. */
  endpoints(): string[] {
    return [...new Set(this.snapshot.rows.map((r) => r.endpoint))]
  }

  /** Types present for a given endpoint. */
  typesFor(endpoint: string): string[] {
    return [...new Set(this.snapshot.rows.filter((r) => r.endpoint === endpoint).map((r) => r.type))]
  }

  /** Dates present. */
  dates(): string[] {
    return [...new Set(this.snapshot.rows.map((r) => r.date))].sort()
  }

  /** Rows filtered by endpoint (+ optional type). */
  filter(endpoint?: string, type?: string): Row[] {
    return this.snapshot.rows.filter((r) =>
      (!endpoint || r.endpoint === endpoint) && (!type || r.type === type),
    )
  }

  private normalize(rows: Row[]): Row[] {
    const byKey = new Map<string, Row>()
    for (const r of rows) byKey.set(`${r.date}|${r.endpoint}|${r.type}`, r)
    return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
}

export const data = new DataStore()


