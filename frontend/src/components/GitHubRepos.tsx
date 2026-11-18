import { fetchProjects } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import { useApi } from '../lib/useApi'

/** Live list of public repositories, served by the Go API (which caches the GitHub REST API). */
export function GitHubRepos() {
  const state = useApi(fetchProjects)

  // Without an API there is nothing live to show; the curated projects above stand on their own.
  if (state.status === 'unconfigured') return null
  if (state.status === 'error' && state.error.code === 'github_not_configured') return null

  return (
    <div className="repos" aria-live="polite">
      <h3 className="subheading">Latest public repositories</h3>

      {state.status === 'loading' && (
        <p className="muted">
          Loading from the API…
          {state.slow && ' The API scales to zero when idle, so the first request can take a few seconds.'}
        </p>
      )}

      {state.status === 'error' && (
        <p className="muted">
          Couldn’t load repositories right now ({state.error.message}){' '}
          <button type="button" className="link-button" onClick={state.retry}>
            Try again
          </button>
        </p>
      )}

      {state.status === 'success' && (
        <>
          {state.data.repos.length === 0 ? (
            <p className="muted">No public repositories yet.</p>
          ) : (
            <ul className="repo-grid">
              {state.data.repos.map((repo) => (
                <li key={repo.name} className="card repo-card">
                  <a href={repo.url} className="repo-name" target="_blank" rel="noreferrer">
                    {repo.name}
                  </a>
                  {repo.description && <p className="repo-desc">{repo.description}</p>}
                  <p className="repo-meta">
                    {repo.language && <span>{repo.language}</span>}
                    {repo.stars > 0 && <span>★ {repo.stars}</span>}
                    <span>Updated {formatDate(repo.pushedAt)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="fineprint">
            Served by the Go API on Azure Container Apps from the GitHub REST API (github.com/{state.data.username}),
            cached since {formatDateTime(state.data.fetchedAt)}.
          </p>
        </>
      )}
    </div>
  )
}
