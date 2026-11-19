import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { profile } from './content/profile'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders the home page from the profile content', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: profile.name })).toBeInTheDocument()
    for (const title of ['About', 'Skills', 'Projects', 'Contact']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    if (profile.email) {
      expect(screen.getByRole('link', { name: profile.email })).toHaveAttribute('href', `mailto:${profile.email}`)
    } else {
      expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
    }
  })

  it('hides the experience section when there is no experience', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    renderAt('/')
    const hasExperience = profile.experience.length > 0
    expect(screen.queryByRole('heading', { level: 2, name: 'Experience' }) !== null).toBe(hasExperience)
  })

  it('renders every required section of the infrastructure page', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    renderAt('/infrastructure')
    expect(await screen.findByRole('heading', { level: 1, name: /built and deployed on azure/i })).toBeInTheDocument()

    const required = [
      'Architecture',
      'Azure services and cost',
      'Deployment workflow',
      'Docker configuration',
      'CI/CD pipeline',
      'Environment configuration',
      'Monitoring and logging',
      'Security considerations',
      'Deployment challenges and solutions',
    ]
    for (const title of required) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: /architecture of this portfolio/i })).toBeInTheDocument()
  })

  it('embeds the real Dockerfile and workflow rather than copies', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    renderAt('/infrastructure')
    const dockerfile = await screen.findByLabelText('Contents of backend/Dockerfile')
    expect(dockerfile).toHaveTextContent('FROM gcr.io/distroless/static-debian12:nonroot')
    expect(screen.getByLabelText('Contents of .github/workflows/ci-cd.yml')).toHaveTextContent('Azure/static-web-apps-deploy')
  })

  it('shows that the API is not configured when no URL is set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    renderAt('/infrastructure')
    const status = await screen.findByRole('heading', { level: 3, name: 'API' })
    const card = status.closest('article')!
    expect(within(card).getByText('Not configured')).toBeInTheDocument()
  })

  it('renders the not-found page for unknown routes', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })

  it('routes and links under the GitHub Pages base path', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    render(
      <MemoryRouter basename="/portfolio/" initialEntries={['/portfolio/infrastructure']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: /built and deployed on azure/i })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('link', { name: 'Infrastructure' })).toHaveAttribute('href', '/portfolio/infrastructure')
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/portfolio/#about')
  })
})
