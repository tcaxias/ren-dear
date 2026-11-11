/**
 * Tiny PT/EN i18n.
 *
 * Default language follows the user language: PT if `navigator.language`
 * starts with `pt`, EN otherwise. A manual switcher overrides the default.
 */

export type Lang = 'pt' | 'en'

export const DICTIONARY: Record<Lang, Record<string, string>> = {
  pt: {
    appTitle: 'REN DataHub',
    loading: 'A carregar…',
    noData: 'Sem dados disponíveis.',
    partialData: 'Dados parciais — algumas datas falharam.',
    offlineError: 'Sem ligação à rede. Os dados em cache estão a ser mostrados.',
    corsError: 'Aceder à API da REN está bloqueado (CORS). Verifique a origem da aplicação.',
    unsupported: 'Disponibilidade não suportada para este arranjo.',
    selectRange: 'Selecione o intervalo de datas',
    from: 'De',
    to: 'Até',
    maxTwoYears: 'O intervalo máximo é de 2 anos.',
    endpoints: 'Endpoints',
    all: 'Todos',
    none: 'Nenhum',
    backfill: 'A preencher histórico',
    fetched: 'obtidos',
    of: 'de',
    date: 'Data',
    value: 'Valor',
    type: 'Tipo',
    endpoint: 'Endpoint',
    pivotTable: 'Tabela dinâmica',
    lineChart: 'Gráfico de linha',
    dataGrid: 'Grelha de dados',
    language: 'Idioma',
    portuguese: 'Português',
    english: 'Inglês',
    errorLoading: 'Erro ao carregar dados.',
    retry: 'Tentar novamente',
    empty: 'Vazio.',
  },
  en: {
    appTitle: 'REN DataHub',
    loading: 'Loading…',
    noData: 'No data available.',
    partialData: 'Partial data — some dates failed.',
    offlineError: 'No network connection. Cached data is being shown.',
    corsError: 'Access to the REN API is blocked (CORS). Check the app origin.',
    unsupported: 'Availability not supported for this arrangement.',
    selectRange: 'Select date range',
    from: 'From',
    to: 'To',
    maxTwoYears: 'Maximum range is 2 years.',
    endpoints: 'Endpoints',
    all: 'All',
    none: 'None',
    backfill: 'Backfilling history',
    fetched: 'fetched',
    of: 'of',
    date: 'Date',
    value: 'Value',
    type: 'Type',
    endpoint: 'Endpoint',
    pivotTable: 'Pivot table',
    lineChart: 'Line chart',
    dataGrid: 'Data grid',
    language: 'Language',
    portuguese: 'Portuguese',
    english: 'English',
    errorLoading: 'Error loading data.',
    retry: 'Retry',
    empty: 'Empty.',
  },
} as const

let current: Lang = typeof navigator !== 'undefined' && navigator.language
  ? (navigator.language.startsWith('pt') ? 'pt' : 'en')
  : 'en'

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
}

export function t(key: string, lang?: Lang): string {
  const l = lang ?? current
  return DICTIONARY[l][key] ?? DICTIONARY['en'][key] ?? key
}
