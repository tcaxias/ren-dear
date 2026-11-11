<script lang="ts">
  import { t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'
  import type { OrchestrateState } from '../lib/orchestrate.js'

  export let state: OrchestrateState

  const show = isEnabled('fetchProgress')

  const failed = state.tasks.filter((t) => t.status === 'failed').length
  const networkFail = state.tasks.some((t) => t.network)
  const pct = state.total ? Math.round((state.fetched / state.total) * 100) : 0
</script>

<div class="fetch-progress" aria-label={t('backfill')}>
  {#if show && state.total > 0}
    <div class="bar {state.running ? 'running' : 'done'}">
      <div
        class="fill"
        style="width: {pct}%"
        data-status={state.running ? 'running' : networkFail ? 'failed' : 'done'}
      ></div>
    </div>
    <div class="caption">
      {t('backfill')} — {state.fetched} {t('fetched')} / {state.total} {t('of')}
      {#if failed > 0}
        <span class="failed">· {failed} {t('failed')}</span>
      {/if}
    </div>
    {#if networkFail}
      <div class="error cors">{t('corsError')}</div>
    {:else if state.error}
      <div class="error">{state.error}</div>
    {/if}
  {/if}
</div>

<style>
  .fetch-progress {
    font-size: 0.85rem;
    margin: 8px 0;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fafafa;
  }
  .caption {
    color: #555;
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
    font-size: 0.9rem;
  }
  .failed {
    color: #b00020;
    font-weight: 600;
  }
  .bar {
    height: 10px;
    background: #eee;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .fill {
    height: 100%;
    background: #2563eb;
    width: 0%;
    transition: width 0.3s ease;
  }
  .fill[data-status="failed"] {
    background: #b00020;
  }
  .fill[data-status="done"] {
    background: #16a34a;
  }
  .error {
    color: #b00020;
    font-size: 0.8rem;
    margin-top: 4px;
    font-weight: 600;
  }
  .error.cors {
    background: #fdecea;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #f5c6c6;
  }
</style>
