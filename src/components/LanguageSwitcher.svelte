<script lang="ts">
  import { setLang, getLang, t } from '../lib/i18n.js'
  import { isEnabled } from '../lib/flags.js'

  const show = isEnabled('languageSwitcher')
  let lang = $state(getLang())

  function switchTo(next: 'pt' | 'en'): void {
    setLang(next)
    lang = next
  }
</script>

<div class="lang-switcher" aria-label={t('language')}>
  {#if show}
    <span class="label">{t('language')}</span>
    <button
      class="{lang === 'pt' ? 'active' : ''}"
      aria-pressed={lang === 'pt'}
      onclick={() => switchTo('pt')}
    >
      {t('portuguese')}
    </button>
    <button
      class="{lang === 'en' ? 'active' : ''}"
      aria-pressed={lang === 'en'}
      onclick={() => switchTo('en')}
    >
      {t('english')}
    </button>
  {/if}
</div>

<style>
  .lang-switcher {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
  }
  .label {
    color: #666;
  }
  button {
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    padding: 2px 10px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button.active {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }
  button:hover {
    border-color: #999;
  }
</style>
