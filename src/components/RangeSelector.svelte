<script lang="ts">
  import { ENDPOINTS } from '../lib/api.js'
  import { DEFAULT_HISTORY_CAP_YEARS } from '../lib/db.js'
  import { isEnabled } from '../lib/flags.js'
  import { t } from '../lib/i18n.js'
  import type { Endpoint } from '../lib/api.js'

  interface RangeChangeDetail {
    from: string
    to: string
    endpointIds: string[]
  }

  let { onrangechange }: { onrangechange?: (detail: RangeChangeDetail) => void } = $props()

  const show = isEnabled('rangeSelector')

  function formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /** Default range: last 2 years ending today. */
  const today = new Date()
  const defaultTo = formatDate(today)
  const defaultFrom = formatDate(
    new Date(Date.UTC(today.getUTCFullYear() - DEFAULT_HISTORY_CAP_YEARS, today.getUTCMonth(), today.getUTCDate())),
  )

  let from = $state(defaultFrom)
  let to = $state(defaultTo)
  /** All endpoints selected by default so a date range alone triggers a fetch. */
  let selected = $state<string[]>(ENDPOINTS.map((e) => e.id))
  let capError = $derived(computeCapError())

  function endpointGrouped(): Record<string, Endpoint[]> {
    const grouped: Record<string, Endpoint[]> = {}
    for (const ep of ENDPOINTS) {
      ;(grouped[ep.sector] ??= []).push(ep)
    }
    return grouped
  }

  function computeCapError(): string {
    if (!from || !to) return ''
    const fromMs = new Date(from).getTime()
    const toMs = new Date(to).getTime()
    const maxTo = new Date(from)
    maxTo.setUTCFullYear(maxTo.getUTCFullYear() + DEFAULT_HISTORY_CAP_YEARS)
    if (toMs > maxTo.getTime()) return t('maxTwoYears')
    return ''
  }

  function toggle(endpointId: string): void {
    if (selected.includes(endpointId)) {
      selected = selected.filter((id) => id !== endpointId)
    } else {
      selected = [...selected, endpointId]
    }
  }

  function toggleAll(checked: boolean): void {
    selected = checked ? ENDPOINTS.map((e) => e.id) : []
  }

  function apply(): void {
    const err = computeCapError()
    if (err) return
    onrangechange?.({ from, to, endpointIds: [...selected] })
  }
</script>

<section class="range-selector" aria-label={t('endpoints')}>
  {#if show}
    <div class="grid">
      <div class="field">
        <label for="from">{t('from')}</label>
        <input id="from" type="date" bind:value={from} />
      </div>
      <div class="field">
        <label for="to">{t('to')}</label>
        <input id="to" type="date" bind:value={to} />
      </div>
      <div class="field actions">
        <button type="button" onclick={apply}>{t('apply')} ({selected.length})</button>
      </div>
    </div>

    <div class="sector-group">
      {#each Object.entries(endpointGrouped()) as [sector, eps]}
        <div class="sector">
          <strong>{sector}</strong>
          <label class="check-all">
            <input type="checkbox" checked={selected.length === eps.length && eps.length > 0}
                   onclick={() => toggleAll(selected.length !== eps.length)} />
            {t('all')}
          </label>
          {#each eps as ep}
            <label class="checkbox">
              <input type="checkbox" checked={selected.includes(ep.id)}
                     onclick={() => toggle(ep.id)} />
              {ep.label.en} ({ep.label.pt})
            </label>
          {/each}
        </div>
      {/each}
    </div>

    {#if capError}
      <p class="error">{capError}</p>
    {/if}
  {/if}
</section>

<style>
  .range-selector {
    font-size: 0.9rem;
    gap: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
    align-items: end;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  label {
    font-size: 0.8rem;
    color: #555;
  }
  input[type="date"] {
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  button {
    border: 1px solid #2563eb;
    background: #2563eb;
    color: #fff;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button:hover {
    background: #1d4ed8;
  }
  .sector-group {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fafafa;
  }
  .sector strong {
    font-size: 0.85rem;
    color: #111;
  }
  .checkbox, .check-all {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .check-all {
    margin-bottom: 4px;
    font-weight: 600;
  }
  .checkbox input, .check-all input {
    width: 16px;
    height: 16px;
  }
  .error {
    color: #b00020;
    font-size: 0.8rem;
    margin: 6px 0 0;
  }
</style>
