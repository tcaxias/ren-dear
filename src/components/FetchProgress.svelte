<script lang="ts">
  import { t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'
  import type { OrchestrateState, FetchTask } from '../lib/orchestrate.js'

  export let state: OrchestrateState

  const show = isEnabled('fetchProgress')
</script>

<div class="fetch-progress" aria-label={t('backfill')}>
  {#if show && state.running}
    <div class="bar">
      <div class="fill" style="width: {state.total ? Math.round((state.fetched / state.total) * 100) : 0}%"></div>
    </div>
    <div class="caption">
      {t('backfill')} — {state.fetched} {t('fetched')} / {state.total} {t('of')}
    </div>
    {#if state.error}
      <div class="error">{state.error}</div>
    {/if}
  {/if}
</div>

<style>
  .fetch-progress {
    font-size: 0.85rem;
    margin: 6px 0;
  }
  .caption {
    color: #555;
  }
  .bar {
    height: 8px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
    margin: 4px 0;
  }
  .fill {
    height: 100%;
    background: #2563eb;
    width: 0%;
    transition: width 0.2s ease;
  }
  .error {
    color: #b00020;
    font-size: 0.8rem;
    margin-top: 4px;
  }
</style>
