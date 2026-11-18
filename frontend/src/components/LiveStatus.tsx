import type { ReactNode } from 'react'
import { apiBaseUrl, fetchStatus } from '../lib/api'
import { buildInfo, commitUrl, isPipelineBuild, shortSha } from '../lib/buildInfo'
import { formatDateTime, formatDuration } from '../lib/format'
import { useApi } from '../lib/useApi'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function Commit({ sha }: { sha: string }) {
  const href = commitUrl(sha)
  const label = shortSha(sha)
  return href ? (
    <a className="mono" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <span className="mono">{label}</span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function FrontendCard() {
  return (
    <article className="card status-card">
      <header className="status-head">
        <h3>Frontend</h3>
        {isPipelineBuild ? <Badge tone="ok">Deployed by pipeline</Badge> : <Badge tone="idle">Local build</Badge>}
      </header>
      <p className="status-sub">Azure Static Web Apps</p>
      <dl className="kv">
        <Row label="Commit">{isPipelineBuild ? <Commit sha={buildInfo.sha} /> : 'not built by CI'}</Row>
        {buildInfo.buildTime && <Row label="Built">{formatDateTime(buildInfo.buildTime)}</Row>}
        <Row label="Served from">
          <span className="mono">{window.location.host}</span>
        </Row>
      </dl>
    </article>
  )
}

function ApiCard() {
  const state = useApi(fetchStatus)

  let badge: ReactNode
  let body: ReactNode
  switch (state.status) {
    case 'unconfigured':
      badge = <Badge tone="idle">Not configured</Badge>
      body = (
        <p className="muted">
          This build has no API URL. Set the <code>API_BASE_URL</code> GitHub variable (see Environment configuration
          below) and redeploy to connect the optional Go API.
        </p>
      )
      break
    case 'loading':
      badge = <Badge tone="idle">Checking…</Badge>
      body = (
        <p className="muted">
          Calling <span className="mono">GET /api/v1/status</span>
          {state.slow && '. No replica was running, so Azure is starting one (scale-from-zero cold start).'}
        </p>
      )
      break
    case 'error':
      badge = <Badge tone="warn">Unreachable</Badge>
      body = (
        <p className="muted">
          {state.error.message}{' '}
          <button type="button" className="link-button" onClick={state.retry}>
            Retry
          </button>
        </p>
      )
      break
    case 'success': {
      const s = state.data
      const onAzure = Boolean(s.runtime.containerApp)
      badge = onAzure ? <Badge tone="ok">Live</Badge> : <Badge tone="idle">Running locally</Badge>
      body = (
        <dl className="kv">
          <Row label="Commit">{/^[0-9a-f]{40}$/i.test(s.commit) ? <Commit sha={s.commit} /> : s.commit}</Row>
          <Row label="Built">{s.buildTime === 'unknown' ? 'unknown' : formatDateTime(s.buildTime)}</Row>
          {onAzure && (
            <>
              <Row label="Revision">
                <span className="mono">{s.runtime.revision}</span>
              </Row>
              <Row label="Replica">
                <span className="mono">{s.runtime.replica}</span>
              </Row>
            </>
          )}
          <Row label="Replica uptime">{formatDuration(s.uptimeSeconds)}</Row>
          <Row label="Runtime">
            {s.goVersion} · {s.environment}
          </Row>
          <Row label="GitHub token">{s.github.authenticated ? 'present (Container Apps secret)' : 'not set'}</Row>
        </dl>
      )
      break
    }
  }

  return (
    <article className="card status-card">
      <header className="status-head">
        <h3>API</h3>
        {badge}
      </header>
      <p className="status-sub">
        Azure Container Apps{apiBaseUrl() && <span className="mono"> · {hostOf(apiBaseUrl())}</span>}
      </p>
      {body}
    </article>
  )
}

/** Live facts read from the running deployment, not hard-coded claims. */
export function LiveStatus() {
  return (
    <div className="status-grid" aria-live="polite">
      <FrontendCard />
      <ApiCard />
    </div>
  )
}
