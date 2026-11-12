<script lang="ts">
  import type { Row } from '../lib/data.js'
  import { t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'

  let { rows = [] }: { rows?: Row[] } = $props()

  const show = isEnabled('pivotTable')

  type Dimension = 'date' | 'endpoint' | 'type'
  type Aggregator = 'sum' | 'avg' | 'min' | 'max'

  let rowDim: Dimension = $state('date')
  let colDim: Dimension = $state('endpoint')
  let agg: Aggregator = $state('sum')

  let pivotResult = $state<{ rowValues: string[]; colValues: string[]; result: Array<{ label: string; cells: Map<string, number> }> }>({
    rowValues: [],
    colValues: [],
    result: [],
  })
  let lastPivotUpdate = 0

  function unique(values: string[]): string[] {
    return [...new Set(values)].sort()
  }

  function aggregate(vals: number[]): number {
    if (vals.length === 0) return 0
    const sum = vals.reduce((a, b) => a + b, 0)
    switch (agg) {
      case 'sum': return sum
      case 'avg': return sum / vals.length
      case 'min': return Math.min(...vals)
      case 'max': return Math.max(...vals)
    }
  }

  function computePivot(): void {
    const rowValues = unique(rows.map((r) => r[rowDim]))
    const colValues = unique(rows.map((r) => r[colDim]))
    const result = rowValues.map((rv) => {
      const cells = new Map<string, number>()
      for (const cv of colValues) {
        const vals = rows.filter((r) => r[rowDim] === rv && r[colDim] === cv).map((r) => r.value)
        cells.set(cv, aggregate(vals))
      }
      return { label: rv, cells }
    })
    pivotResult = { rowValues, colValues, result }
  }

  /** Recompute pivot at most once per 100ms — avoids O(n²) churn on every row merge during backfill. */
  $effect(() => {
    const now = Date.now()
    if (now - lastPivotUpdate < 100) return
    lastPivotUpdate = now
    computePivot()
  })
</script>

<section class="pivot-table" aria-label={t('pivotTable')}>
  {#if show}
    <div class="controls">
      <div class="control">
        <label>{t('date')} / {t('endpoint')} / {t('type')}</label>
        <select bind:value={rowDim} aria-label="rows">
          <option value="date">{t('date')}</option>
          <option value="endpoint">{t('endpoint')}</option>
          <option value="type">{t('type')}</option>
        </select>
        <label>Rows</label>
      </div>
      <div class="control">
        <select bind:value={colDim} aria-label="columns">
          <option value="date">{t('date')}</option>
          <option value="endpoint">{t('endpoint')}</option>
          <option value="type">{t('type')}</option>
        </select>
        <label>Columns</label>
      </div>
      <div class="control">
        <select bind:value={agg} aria-label="aggregator">
          <option value="sum">Sum</option>
          <option value="avg">Avg</option>
          <option value="min">Min</option>
          <option value="max">Max</option>
        </select>
        <label>Aggregator</label>
      </div>
    </div>

    {#if pivotResult.result.length === 0}
      <p class="empty">{t('noData')}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{rowDim === 'date' ? t('date') : rowDim === 'endpoint' ? t('endpoint') : t('type')}</th>
            {#each pivotResult.colValues as cv}
              <th>{cv}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each pivotResult.result as rv}
            <tr>
              <td class="label">{rv.label}</td>
              {#each pivotResult.colValues as cv}
                <td>{rv.cells.get(cv) ?? 0}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</section>

<style>
  .pivot-table { font-size: 0.9rem; }
  .controls {
    display: flex;
    gap: 14px;
    margin-bottom: 10px;
    flex-wrap: wrap;
    align-items: end;
  }
  .control { display: flex; flex-direction: column; gap: 4px; }
  .control label { font-size: 0.75rem; color: #555; }
  select { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; }
  th { background: #f5f5f5; font-size: 0.8rem; color: #444; }
  td.label { text-align: left; font-weight: 600; background: #fafafa; }
  tr:hover td { background: #f0f7ff; }
  .empty { color: #666; font-size: 0.9rem; padding: 8px 0; }
</style>
