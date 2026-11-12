/**
 * REN DataHub API client.
 *
 * Base: https://servicebus.ren.pt/datahubapi/
 * Format: JSON, no API key documented.
 * Params: culture (pt-PT | en-US), year (yyyy), month (mm), date (yyyy-mm-dd).
 *
 * Response shape: array of { daily_Accumulation: number, type: string }.
 * The date/month is NOT in the body — it is the request param, so the caller
 * must tag each response with its date/month before storing or displaying it.
 *
 * NOTE: the exact endpoint paths below reflect the themes/granularities listed
 * in the API docs (balance, production/consumption, grid balances, market
 * prices, installed power, yearly variation across electricity + gas). They
 * should be confirmed against https://datahub.ren.pt/pt/instrucoes-api/ and
 * adjusted here if the real paths differ.
 */

export const API_BASE = 'https://carry-boo.tcx.workers.dev/'

export type Culture = 'pt-PT' | 'en-US'
export type Granularity = 'daily' | 'monthly' | 'yearly'
export type Sector = 'electricity' | 'gas'
export type Theme =
  | 'balance'
  | 'production'
  | 'consumption'
  | 'grid'
  | 'market'
  | 'installed-power'
  | 'yearly-variation'

export interface RenRecord {
  /** Value as returned by the API (daily accumulation). */
  daily_Accumulation: number
  /** Categorical label for the record (e.g. tariff, region, energy type). */
  type: string
}

/** Params accepted by the API. Only the ones matching the endpoint granularity
 * should be sent. */
export interface DateParams {
  date?: string // yyyy-mm-dd  (daily)
  year?: number // yyyy        (monthly + yearly)
  month?: number // mm         (monthly)
}

export interface Endpoint {
  id: string
  path: string
  sector: Sector
  granularity: Granularity
  theme: Theme
  label: { pt: string; en: string }
  /** Query params this endpoint requires. */
  params: Array<'date' | 'year' | 'month'>
}

export const ENDPOINTS: Endpoint[] = [
  {
    id: 'elec-balance-daily',
    path: 'eletricidade/balanco/diario',
    sector: 'electricity',
    granularity: 'daily',
    theme: 'balance',
    label: { pt: 'Balanço elétrico (diário)', en: 'Electrical balance (daily)' },
    params: ['date'],
  },
  {
    id: 'elec-production-daily',
    path: 'eletricidade/producao/diario',
    sector: 'electricity',
    granularity: 'daily',
    theme: 'production',
    label: { pt: 'Produção elétrica (diário)', en: 'Electrical production (daily)' },
    params: ['date'],
  },
  {
    id: 'elec-consumption-daily',
    path: 'eletricidade/consumo/diario',
    sector: 'electricity',
    granularity: 'daily',
    theme: 'consumption',
    label: { pt: 'Consumo elétrico (diário)', en: 'Electrical consumption (daily)' },
    params: ['date'],
  },
  {
    id: 'elec-grid-daily',
    path: 'eletricidade/rede/diario',
    sector: 'electricity',
    granularity: 'daily',
    theme: 'grid',
    label: { pt: 'Balancete de rede elétrica (diário)', en: 'Electrical grid balance (daily)' },
    params: ['date'],
  },
  {
    id: 'elec-market-daily',
    path: 'eletricidade/mercado/diario',
    sector: 'electricity',
    granularity: 'daily',
    theme: 'market',
    label: { pt: 'Preços de mercado elétrico (diário)', en: 'Electrical market prices (daily)' },
    params: ['date'],
  },
  {
    id: 'elec-installed-yearly',
    path: 'eletricidade/instalada/anual',
    sector: 'electricity',
    granularity: 'yearly',
    theme: 'installed-power',
    label: { pt: 'Potência instalada elétrica (anual)', en: 'Installed electrical power (yearly)' },
    params: ['year'],
  },
  {
    id: 'elec-variation-yearly',
    path: 'eletricidade/variacao/anual',
    sector: 'electricity',
    granularity: 'yearly',
    theme: 'yearly-variation',
    label: { pt: 'Variação anual elétrica', en: 'Yearly electrical variation' },
    params: ['year'],
  },
  {
    id: 'gas-balance-daily',
    path: 'gas/balanco/diario',
    sector: 'gas',
    granularity: 'daily',
    theme: 'balance',
    label: { pt: 'Balanço de gás (diário)', en: 'Gas balance (daily)' },
    params: ['date'],
  },
  {
    id: 'gas-consumption-daily',
    path: 'gas/consumo/diario',
    sector: 'gas',
    granularity: 'daily',
    theme: 'consumption',
    label: { pt: 'Consumo de gás (diário)', en: 'Gas consumption (daily)' },
    params: ['date'],
  },
  {
    id: 'gas-installed-yearly',
    path: 'gas/instalada/anual',
    sector: 'gas',
    granularity: 'yearly',
    theme: 'installed-power',
    label: { pt: 'Potência instalada de gás (anual)', en: 'Installed gas power (yearly)' },
    params: ['year'],
  },
] as const

export function endpointById(id: string): Endpoint | undefined {
  return ENDPOINTS.find((e) => e.id === id)
}

/** Build the absolute API URL for an endpoint + params + culture. */
export function buildUrl(
  endpoint: Endpoint,
  params: DateParams,
  culture: Culture,
): URL {
  const url = new URL(`${API_BASE}${endpoint.path}`)
  url.searchParams.set('culture', culture)
  if (endpoint.params.includes('date') && params.date) {
    url.searchParams.set('date', params.date)
  }
  if (endpoint.params.includes('year') && params.year) {
    url.searchParams.set('year', String(params.year))
  }
  if (endpoint.params.includes('month') && params.month) {
    url.searchParams.set('month', String(params.month).padStart(2, '0'))
  }
  return url
}

interface FetchOptions {
  retries?: number
  signal?: AbortSignal
}

/**
 * Fetch JSON from the REN DataHub API with retries + exponential backoff.
 * Throws on HTTP error or after exhausting retries.
 */
export async function fetchRen<T = RenRecord[]>(
  endpoint: Endpoint,
  params: DateParams,
  culture: Culture,
  { retries = 3, signal }: FetchOptions = {},
): Promise<T> {
  const url = buildUrl(endpoint, params, culture)
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal })
      if (!res.ok) {
        throw new ApiError(
          `API ${endpoint.id} failed: ${res.status} ${res.statusText}`,
          res.status,
          endpoint.id,
        )
      }
      return (await res.json()) as T
    } catch (err) {
      lastError = err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      // Don't retry client errors (4xx) except 429.
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 429
      ) {
        throw err
      }
      if (attempt === retries) {
        break
      }
      await sleep(backoffMs(attempt))
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff: 500ms, 1000ms, 2000ms, ... capped at ~8s. */
function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000)
}

export class ApiError extends Error {
  readonly status: number
  readonly endpoint: string
  constructor(message: string, status: number, endpoint: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
  }
}

/** True when the error is a network/CORS failure rather than an API error. */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return /failed to fetch|network|cors|cross-origin|access-control/i.test(msg)
  }
  return false
}
