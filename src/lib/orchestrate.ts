/**
 * Fetch orchestration for the REN DataHub.
 *
 * Expands a user-selected range into per-date (daily) or per-month (monthly)
 * tasks, runs them behind a concurrency-limited queue (~3 in flight), tracks
 * progress (fetched / total, per-date ok/failed), and resumes on reload by
 * serving cached dates without refetching.
 *
 * The orchestrator is decoupled from the API client: the caller supplies a
 * `fetchTask` callback that resolves the Endpoint and calls the API (via
 * `getOrFetch`, so cache hits short-circuit with no network).
 */

import { get, writable } from 'svelte/store'
import type { Endpoint, DateParams, RenRecord, Culture } from './api.js'
import { dateKeyFor, db } from './db.js'
import { isNetworkError } from './api.js'

export const CONCURRENCY = 3

export type TaskStatus = 'queued' | 'running' | 'ok' | 'failed'

export interface FetchTask {
  id: string
  endpointId: string
  endpointLabel: string
  granularity: string
  dateKey: string
  params: DateParams
  status: TaskStatus
  rows: RenRecord[] // rows tagged with dateKey by the consumer before rendering
  error?: string
  attempts: number
  /** True when the failure was a network/CORS problem (not an API error). */
  network?: boolean
}

export interface OrchestrateState {
  tasks: FetchTask[]
  fetched: number
  total: number
  running: boolean
  error: string | null
}

function initialState(): OrchestrateState {
  return {
    tasks: [],
    fetched: 0,
    total: 0,
    running: false,
    error: null,
  }
}

/** Build the per-date (or per-month) task list for one endpoint over a range. */
export function expandRange(
  endpoint: Endpoint,
  from: Date,
  to: Date,
): DateParams[] {
  const paramsList: DateParams[] = []

  if (endpoint.granularity === 'daily') {
    const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
    const end = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()))
    while (d <= end) {
      paramsList.push({ date: formatDate(d) })
      d.setUTCDate(d.getUTCDate() + 1)
    }
  } else if (endpoint.granularity === 'monthly') {
    let y = from.getFullYear()
    let m = from.getMonth()
    const endY = to.getFullYear()
    const endM = to.getMonth()
    while (y < endY || (y === endY && m <= endM)) {
      paramsList.push({ year: y, month: m + 1 })
      m++
      if (m === 12) { m = 0; y++ }
    }
  } else {
    // yearly
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      paramsList.push({ year: y })
    }
  }

  return paramsList
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Callback the caller implements to fetch one task (usually via getOrFetch). */
export type FetchTaskFn = (
  task: FetchTask,
  endpoints: Endpoint[],
  culture: Culture,
) => Promise<RenRecord[]>

/**
 * Orchestrator: plans tasks, runs them concurrency-limited, exposes a Svelte
 * store so the UI can react to progress.
 */
export class Orchestrator {
  private state = writable<OrchestrateState>(initialState())
  private running = false
  private abort?: AbortController

  subscribe(...args: Parameters<typeof this.state.subscribe>) {
    return this.state.subscribe(...args)
  }

  get snapshot(): OrchestrateState {
    return get(this.state)
  }

  /** Plan tasks for the given endpoints over [from, to]. All tasks start
   * `queued`. Does not start fetching. */
  plan(endpoints: Endpoint[], from: Date, to: Date): void {
    const tasks: FetchTask[] = []
    for (const endpoint of endpoints) {
      const paramsList = expandRange(endpoint, from, to)
      for (const params of paramsList) {
        tasks.push({
          id: `${endpoint.id}:${dateKeyFor(endpoint, params)}`,
          endpointId: endpoint.id,
          endpointLabel: endpoint.label.en,
          granularity: endpoint.granularity,
          dateKey: dateKeyFor(endpoint, params),
          params,
          status: 'queued',
          rows: [],
          error: undefined,
          attempts: 0,
        })
      }
    }

    this.state.set({
      tasks,
      total: tasks.length,
      fetched: 0,
      running: false,
      error: null,
    })
  }

  /** Mark already-cached tasks as `ok` (resume on reload — no refetch). */
  async markCachedOk(endpoints: Endpoint[]): Promise<void> {
    const byId = new Map(endpoints.map((e) => [e.id, e]))
    let changed = false
    // Collect all queued tasks that might have a cache entry.
    const queuedTasks = this.snapshot.tasks.filter((t) => t.status === 'queued')
    if (queuedTasks.length === 0) return
    // Batch all cache lookups in parallel instead of sequential awaits.
    const keys = queuedTasks.map((t) => {
      const endpoint = byId.get(t.endpointId)
      return endpoint ? [endpoint.id, t.dateKey] as [string, string] : null
    }).filter((k): k is [string, string] => k !== null)
    let cached: Array<{ endpoint: string; dateKey: string; payload: RenRecord[]; fetchedAt: number; params?: DateParams } | undefined>
    try {
      cached = await db.fetches.bulkGet(keys)
    } catch (err) {
      console.warn('[orchestrator] markCachedOk bulkGet failed, skipping cache check:', err)
      return
    }
    cached.forEach((entry, i) => {
      if (!entry) return
      const task = queuedTasks[i]
      this.state.update((s) => {
        const t = s.tasks.find((x) => x.id === task.id)
        if (t) { t.status = 'ok'; t.rows = entry.payload; changed = true }
        return s
      })
    })
    if (changed) this.recalcFetched()
  }

  private lastFetchedUpdate = 0
  private lastStatusUpdate = 0

  private recalcFetched(): void {
    const now = Date.now()
    const allDone = this.snapshot.tasks.every((t) => t.status !== 'queued' && t.status !== 'running')
    // Throttle fetched-count updates to at most once per 100ms during active fetching.
    // Always update when everything is done so the final count is accurate.
    if (!allDone && now - this.lastFetchedUpdate < 100) return
    this.lastFetchedUpdate = now
    this.state.update((s) => {
      s.fetched = s.tasks.filter((t) => t.status === 'ok').length
      return s
    })
  }

  private setStatus(taskId: string, status: TaskStatus, patch?: Partial<FetchTask>): void {
    const now = Date.now()
    const allDone = this.snapshot.tasks.every((t) => t.status !== 'queued' && t.status !== 'running')
    const t = this.snapshot.tasks.find((x) => x.id === taskId)
    if (t) {
      t.status = status
      if (patch) Object.assign(t, patch)
    }
    // Throttle store notifications: propagate at most once per 100ms during
    // active fetching, always on completion so the final state is accurate.
    if (!allDone && now - this.lastStatusUpdate < 100) return
    this.lastStatusUpdate = now
    this.state.update((s) => {
      const tt = s.tasks.find((x) => x.id === taskId)
      if (tt) {
        tt.status = status
        if (patch) Object.assign(tt, patch)
      }
      return s
    })
  }

  /** Run all queued tasks with concurrency limit. */
  async execute(fetchTask: FetchTaskFn, endpoints: Endpoint[], culture: Culture): Promise<void> {
    if (this.running) return
    this.running = true
    this.abort = new AbortController()

    try {
      this.state.update((s) => ({ ...s, running: true, error: null }))

      const queuedCount = this.snapshot.tasks.filter((t) => t.status === 'queued').length
      console.log('[orchestrator] execute() starting', { queuedCount, workers: Math.min(CONCURRENCY, queuedCount) })
      if (queuedCount === 0) {
        this.state.update((s) => ({ ...s, running: false }))
        this.running = false
        return
      }

      const workers = Math.min(CONCURRENCY, queuedCount)
      const workerPromises: Promise<void>[] = []
      for (let w = 0; w < workers; w++) {
        workerPromises.push(this.worker(fetchTask, endpoints, culture))
      }
      await Promise.all(workerPromises)

      const state = this.snapshot
      const failed = state.tasks.filter((t) => t.status === 'failed')
      if (failed.length && state.fetched === 0) {
        this.state.update((s) => ({ ...s, error: 'All fetch attempts failed.', running: false }))
      } else if (failed.length) {
        this.state.update((s) => ({ ...s, error: `Some dates failed (${failed.length}).`, running: false }))
      } else {
        this.state.update((s) => ({ ...s, running: false }))
      }
    } finally {
      this.running = false
      this.abort = undefined
    }
  }

  private async worker(
    fetchTask: FetchTaskFn,
    endpoints: Endpoint[],
    culture: Culture,
  ): Promise<void> {
    while (true) {
      let taskId: string | undefined
      this.state.update((s) => {
        const t = s.tasks.find((x) => x.status === 'queued')
        if (!t) return s
        taskId = t.id
        t.status = 'running'
        t.attempts += 1
        return s
      })
      if (!taskId) break
      console.log('[orchestrator] worker starting task', { taskId })

      const task = this.snapshot.tasks.find((x) => x.id === taskId)!
      try {
        const rows = await fetchTask(task, endpoints, culture)
        this.state.update((s) => {
          const t = s.tasks.find((x) => x.id === taskId)
          if (t) { t.status = 'ok'; t.rows = rows; t.error = undefined }
          return s
        })
        this.recalcFetched()
        console.log('[orchestrator] worker task completed', { taskId })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.log('[orchestrator] worker task failed', { taskId, error: message, network: isNetworkError(err) })
        this.state.update((s) => {
          const t = s.tasks.find((x) => x.id === taskId)
          if (t) {
            t.status = 'failed'
            t.error = message
            t.network = isNetworkError(err)
          }
          return s
        })
      }
    }
  }
}

export function createOrchestrator(): Orchestrator {
  return new Orchestrator()
}
