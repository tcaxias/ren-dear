<script lang="ts">
  import type { Row } from '../lib/data.js'
  import { t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'

  let { rows = [] }: { rows?: Row[] } = $props()

  const show = isEnabled('dataGrid')

  let sortKey: keyof Row | null = $state('date')
  let sortDir: 'asc' | 'desc' = $state('asc')
  let filter = $state('')

  const sorted = $derived([...rows].sort((a, b) => {
    let av: any = a[sortKey!]
    let bv: any = b[sortKey!]
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    let cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  }))

  const filtered = $derived(
    sorted.filter((r) => {
      const f = filter.toLowerCase()
      return [r.date, r.endpoint, r.type, String(r.value)].some((v) =>
        v.toLowerCase().includes(f),
      )
    }),
  )

  function sortBy(key: keyof Row): void {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    else { sortKey = key; sortDir = 'asc' }
  }
</script>

<section class="data-grid" aria-label={t('dataGrid')}>
  {#if show}
    <div class="toolbar">
      <input type="text" bind:value={filter} placeholder={t('endpoints')} aria-label="filter" />
      <span class="count">{filtered.length} rows</span>
    </div>

    {#if filtered.length === 0}
      <p class="empty">{t('noData')}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th onclick={() => sortBy('date')} class="{sortKey === 'date' ? sortDir : ''}">{t('date')} ▲▼</th>
            <th onclick={() => sortBy('endpoint')} class="{sortKey === 'endpoint' ? sortDir : ''}">{t('endpoint')} ▲▼</th>
            <th onclick={() => sortBy('type')} class="{sortKey === 'type' ? sortDir : ''}">{t('type')} ▲▼</th>
            <th onclick={() => sortBy('value')} class="{sortKey === 'value' ? sortDir : ''}">{t('value')} ▲▼</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as r}
            <tr>
              <td>{r.date}</td>
              <td>{r.endpoint}</td>
              <td>{r.type}</td>
              <td class="num">{r.value}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</section>

<style>
  .data-grid { font-size: 0.85rem; }
  .toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
    align-items: center;
  }
  input {
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 220px;
  }
  .count { font-size: 0.8rem; color: #555; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; cursor: pointer; }
  th { background: #f5f5f5; user-select: none; font-size: 0.75rem; }
  th.asc::after { content: ' ▲'; font-size: 0.7rem; }
  th.desc::after { content: ' ▼'; font-size: 0.7rem; }
  td.num { text-align: right; }
  tr:hover td { background: #f0f7ff; }
  .empty { color: #666; font-size: 0.9rem; padding: 8px 0; }
</style>
