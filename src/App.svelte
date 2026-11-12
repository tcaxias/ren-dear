<script lang="ts">
  import { createOrchestrator, type OrchestrateState, type FetchTask } from './lib/orchestrate.js'
  import { ENDPOINTS, type Culture } from './lib/api.js'
  import { data, type Row } from './lib/data.js'
  import { getLang, t, type Lang } from './lib/i18n.js'
  import { getOrFetch } from './lib/db.js'
  import { fetchRen } from './lib/api.js'

  import LanguageSwitcher from './components/LanguageSwitcher.svelte'
  import RangeSelector from './components/RangeSelector.svelte'
  import FetchProgress from './components/FetchProgress.svelte'
  import PivotTable from './components/PivotTable.svelte'
  import LineChart from './components/LineChart.svelte'
  import DataGrid from './components/DataGrid.svelte'

  let lang: Lang = getLang()
  let view: 'pivot' | 'chart' | 'grid' = $state('pivot')
  let selectedEndpointIds: string[] = []

  let orchestrator = createOrchestrator()
  let progress: OrchestrateState = $state(orchestrator.snapshot)
  let unsub: (() => void) | null = null

  let lastRange: { from: string; to: string; endpointIds: string[] } | null = null
  let error: string | null = $state(null)
  let corsError: boolean = $state(false)
  let partial: boolean = $state(false)
  let retrying: boolean = $state(false)

  let rows: Row[] = $state(data.snapshot.rows)
  data.subscribe((s) => { rows = s.rows })

  function apiCulture(l: Lang): Culture {
    return l === 'pt' ? 'pt-PT' : 'en-US'
  }

  function subscribeProgress(): void {
    unsub?.()
    unsub = orchestrator.subscribe((s) => {
      progress = s
    })
  }

  function selectedEndpoints(): (typeof ENDPOINTS)[number][] {
    return ENDPOINTS.filter((e) => selectedEndpointIds.includes(e.id))
  }

  /** Convert raw API records into UI rows, tagged with the date key. */
  function toRows(
    endpointId: string,
    dateKey: string,
    records: { daily_Accumulation: number; type: string }[],
  ): Row[] {
    return records.map((r) => ({
      date: dateKey,
      endpoint: endpointId,
      type: r.type,
      value: r.daily_Accumulation,
    }))
  }

  async function onRangeChange(detail: {
    from: string
    to: string
    endpointIds: string[]
  }): Promise<void> {
    lastRange = detail
    const { from, to, endpointIds } = detail
    selectedEndpointIds = endpointIds
    error = null
    corsError = false
    partial = false

    const endpoints = selectedEndpoints()
    if (endpoints.length === 0) {
      data.clear()
      progress = orchestrator.snapshot
      return
    }

    const fromDate = new Date(`${from}T00:00:00Z`)
    const toDate = new Date(`${to}T00:00:00Z`)

    data.setLoading(true)
    orchestrator = createOrchestrator()
    subscribeProgress()

    orchestrator.plan(endpoints, fromDate, toDate)
    await orchestrator.markCachedOk(endpoints)

    // Merge any cached rows into the UI dataset (resume on reload).
    const cachedRows: Row[] = []
    for (const task of orchestrator.snapshot.tasks) {
      if (task.status === 'ok' && task.rows.length) {
        cachedRows.push(...toRows(task.endpointId, task.dateKey, task.rows))
      }
    }
    if (cachedRows.length) data.merge(cachedRows)

    const culture = apiCulture(lang)

    async function fetchTask(task: FetchTask, eps: (typeof ENDPOINTS)[number][], c: Culture) {
      const endpoint = eps.find((e) => e.id === task.endpointId)
      if (!endpoint) throw new Error(`Unknown endpoint ${task.endpointId}`)
      const records = await getOrFetch(endpoint, task.params, () => fetchRen(endpoint, task.params, c))
      return records // RenRecord[]: the consumer (App) tags rows with dateKey via toRows() at merge time
    }

    console.log('[ren-dear] onRangeChange about to execute()', {
      tasks: orchestrator.snapshot.total,
      fetched: orchestrator.snapshot.fetched,
      endpoints: endpoints.length,
    })

    try {
      await orchestrator.execute(fetchTask, endpoints, culture)
    } catch (err) {
      console.log('[ren-dear] onRangeChange execute() threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Merge freshly fetched rows.
    const newRows: Row[] = []
    for (const task of orchestrator.snapshot.tasks) {
      if (task.status === 'ok' && task.rows.length) {
        newRows.push(...toRows(task.endpointId, task.dateKey, task.rows))
      }
    }
    if (newRows.length) data.merge(newRows)

    const failed = orchestrator.snapshot.tasks.filter((t) => t.status === 'failed')
    const networkFail = failed.some((t) => t.network)
    console.log('[ren-dear] range applied', {
      endpoints: endpoints.length,
      tasks: orchestrator.snapshot.total,
      fetched: orchestrator.snapshot.fetched,
      failed: failed.length,
      networkFail,
      rows: data.snapshot.rows.length,
    })
    if (networkFail) corsError = true
    else if (failed.length && orchestrator.snapshot.fetched === 0) {
      error = t('errorLoading')
    } else if (failed.length) {
      partial = true
    }

    data.setLoading(false)
  }

  async function retry(): Promise<void> {
    if (!lastRange || retrying) return
    retrying = true
    try {
      await onRangeChange(lastRange)
    } finally {
      retrying = false
    }
  }
</script>

<div class="app">
  <header class="bar">
    <h1>{t('appTitle')}</h1>
    <LanguageSwitcher />
  </header>

  <main>
    {#if corsError}
      <div class="alert alert-error cors-banner">
        <strong>{t('corsError')}</strong>
        <button class="retry" onclick={retry} disabled={retrying}>
          {retrying ? t('loading') : t('retry')}
        </button>
      </div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else if partial}
      <div class="alert alert-warn">{t('partialData')}</div>
    {/if}

    <section class="controls">
      <RangeSelector onrangechange={onRangeChange} />
      <FetchProgress state={progress} />
    </section>

    {#if rows.length > 0}
      <nav class="tabs">
        <button class="{view === 'pivot' ? 'active' : ''}" onclick={() => { view = 'pivot' }}>{t('pivotTable')}</button>
        <button class="{view === 'chart' ? 'active' : ''}" onclick={() => { view = 'chart' }}>{t('lineChart')}</button>
        <button class="{view === 'grid' ? 'active' : ''}" onclick={() => { view = 'grid' }}>{t('dataGrid')}</button>
      </nav>

      {#if view === 'pivot'}
        <PivotTable {rows} />
      {:else if view === 'chart'}
        <div class="chart-wrap">
          <LineChart {rows} />
        </div>
      {:else if view === 'grid'}
        <DataGrid {rows} />
      {/if}
    {:else if !corsError && !error && progress.total > 0}
      <p class="empty">{t('noData')}</p>
    {/if}
  </main>
</div>

<style>
  .app { max-width: 1000px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0 16px;
    border-bottom: 1px solid #ddd;
  }
  h1 { font-size: 1.25rem; margin: 0; }
  main { display: flex; flex-direction: column; gap: 16px; }
  .controls {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid #ddd;
    margin-bottom: 8px;
  }
  .tabs button {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #555;
  }
  .tabs button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
    font-weight: 600;
  }
  .chart-wrap { height: 360px; }
  .alert {
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 0.9rem;
  }
  .alert-error {
    background: #fdecea;
    color: #b00020;
    border: 1px solid #f5c6c6;
  }
  .alert-warn {
    background: #fff7e6;
    color: #8a6d00;
    border: 1px solid #e9d99e;
  }
  .empty { color: #666; font-size: 0.95rem; padding: 16px 0; }
  .cors-banner {
    background: #fdecea;
    color: #b00020;
    border: 2px solid #b00020;
    padding: 14px 16px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cors-banner strong {
    display: block;
    width: 100%;
    font-size: 1rem;
  }
  .cors-banner .retry {
    background: #b00020;
    color: #fff;
    border: none;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .cors-banner .retry:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
