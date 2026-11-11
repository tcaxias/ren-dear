<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { createChart, ColorType, LineSeries } from 'lightweight-charts'
  import type { Row } from '../lib/data.js'
  import { t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'

  let { rows = [], title = t('lineChart') }: { rows?: Row[]; title?: string } = $props()

  const show = isEnabled('lineChart')

  let container: HTMLDivElement | null = null
  let chart: ReturnType<typeof createChart> | null = null
  let series: any = null
  let resizeObserver: ResizeObserver | null = null

  function padToDay(dateKey: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
    if (/^\d{4}-\d{2}$/.test(dateKey)) return `${dateKey}-01`
    if (/^\d{4}$/.test(dateKey)) return `${dateKey}-01-01`
    return dateKey
  }

  function seriesData(): { time: string; value: number }[] {
    return [...rows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ time: padToDay(r.date), value: r.value }))
  }

  function resize(): void {
    if (!chart || !container) return
    chart.applyOptions({ width: container.clientWidth, height: 320 })
  }

  onMount(() => {
    if (!container || !show) return
    chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: { vertLines: { color: '#eaeaea' }, horzLines: { color: '#eaeaea' } },
      width: container.clientWidth || 600,
      height: 320,
      timeScale: { timeVisible: true, secondsVisible: false },
    })
    series = chart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 2 })
    series.setData(seriesData())

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
  })

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect()
    if (chart) chart.remove()
  })

  // React to new data.
  $effect(() => {
    if (series) series.setData(seriesData())
  })
</script>

<div class="line-chart" aria-label={title} bind:this={container}>
  {#if show}
    {#if rows.length === 0}
      <div class="empty">{t('noData')}</div>
    {/if}
  {/if}
</div>

<style>
  .line-chart {
    width: 100%;
    height: 340px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .empty { color: #666; font-size: 0.9rem; }
</style>
