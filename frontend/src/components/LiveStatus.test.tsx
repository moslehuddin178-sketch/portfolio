import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiStatus } from '../lib/api'
import { LiveStatus } from './LiveStatus'

const status: ApiStatus = {
  service: 'portfolio-api',
  version: 'abc',
  commit: '0123456789abcdef0123456789abcdef01234567',
  buildTime: '2026-11-18T10:00:00Z',
  goVersion: 'go1.27.4',
  environment: 'production',
  startedAt: '2026-11-18T10:05:00Z',
  uptimeSeconds: 3725,
  runtime: { containerApp: 'ca-portfolio-api', revision: 'ca-portfolio-api--0000001', replica: 'ca-portfolio-api--0000001-abc' },
  github: { configured: true, authenticated: false },
}

function mockFetch(response: Response | Error) {
  const fn = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('LiveStatus', () => {
  it('shows the live revision reported by the API', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
    const fetchMock = mockFetch(new Response(JSON.stringify(status), { status: 200 }))

    render(<LiveStatus />)

    expect(await screen.findByText('Live')).toBeInTheDocument()
    expect(screen.getByText('ca-portfolio-api--0000001')).toBeInTheDocument()
    expect(screen.getByText('0123456')).toBeInTheDocument()
    expect(screen.getByText('1h 2m')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/status', expect.anything())
  })

  it('reports a local API honestly when Azure runtime variables are absent', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
    mockFetch(new Response(JSON.stringify({ ...status, runtime: {} }), { status: 200 }))

    render(<LiveStatus />)

    expect(await screen.findByText('Running locally')).toBeInTheDocument()
    expect(screen.queryByText('Revision')).not.toBeInTheDocument()
  })

  it('shows an error with a retry when the API is unreachable', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    mockFetch(new TypeError('Failed to fetch'))

    render(<LiveStatus />)

    expect(await screen.findByText('Unreachable')).toBeInTheDocument()
    expect(screen.getByText(/could not reach the api/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
