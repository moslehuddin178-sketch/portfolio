// Typed client for the Go portfolio API (backend/internal/httpapi).

export interface ApiStatus {
  service: string
  version: string
  commit: string
  buildTime: string
  goVersion: string
  environment: string
  startedAt: string
  uptimeSeconds: number
  runtime: { containerApp?: string; revision?: string; replica?: string }
  github: { configured: boolean; authenticated: boolean }
}

export interface Repo {
  name: string
  description: string
  url: string
  homepage?: string
  language?: string
  stars: number
  topics: string[]
  pushedAt: string
}

export interface ProjectsResponse {
  username: string
  fetchedAt: string
  repos: Repo[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Read at call time (not import time) so tests can stub the environment. */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
}

export function isApiConfigured(): boolean {
  return apiBaseUrl() !== ''
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = apiBaseUrl()
  if (!base) throw new ApiError(0, 'not_configured', 'The API URL is not configured for this build.')

  let res: Response
  try {
    res = await fetch(`${base}${path}`, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(0, 'network_error', 'Could not reach the API.')
  }

  if (!res.ok) {
    let code = 'http_error'
    let message = `The API responded with HTTP ${res.status}.`
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      code = body.error ?? code
      message = body.message ?? message
    } catch {
      // non-JSON error body: keep the generic message
    }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

export const fetchStatus = (signal?: AbortSignal) => getJSON<ApiStatus>('/api/v1/status', signal)
export const fetchProjects = (signal?: AbortSignal) => getJSON<ProjectsResponse>('/api/v1/projects', signal)
