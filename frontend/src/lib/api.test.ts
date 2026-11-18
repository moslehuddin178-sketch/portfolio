import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiBaseUrl, fetchProjects, isApiConfigured } from './api'

describe('api client', () => {
  it('normalises the base URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', '  https://api.example.test///  ')
    expect(apiBaseUrl()).toBe('https://api.example.test')
    expect(isApiConfigured()).toBe(true)
  })

  it('treats an empty URL as not configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(isApiConfigured()).toBe(false)
    await expect(fetchProjects()).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('maps API error bodies to ApiError', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'github_not_configured', message: 'GITHUB_USERNAME is not set' }), { status: 503 }),
        ),
      ),
    )
    const err = await fetchProjects().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 503, code: 'github_not_configured' })
  })
})
