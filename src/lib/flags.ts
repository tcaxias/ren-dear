/**
 * Local feature flags.
 *
 * Gate every user-visible behavior behind a flag here. Flags are documented
 * so they can be toggled (or removed) without hunting through the UI.
 *
 * Default state is defined here; a future step could read `localStorage`
 * overrides, but for now flags are code-configured only.
 */

export const FLAGS = {
  /** Enable the pivot table view (rows × columns × values × aggregator). */
  pivotTable: true,
  /** Enable the line chart view (Lightweight Charts). */
  lineChart: true,
  /** Enable the raw data grid view (filterable/sortable). */
  dataGrid: true,
  /** Enable the range selector + endpoint checkboxes + 2-year cap. */
  rangeSelector: true,
  /** Enable the manual PT/EN language switcher. */
  languageSwitcher: true,
  /** Enable IndexedDB cache + resume-on-reload backfill. */
  indexedDbCache: true,
  /** Show the per-date fetch progress UI while backfilling. */
  fetchProgress: true,
} as const

export type FlagName = keyof typeof FLAGS

export function isEnabled(flag: FlagName): boolean {
  return !!FLAGS[flag]
}
