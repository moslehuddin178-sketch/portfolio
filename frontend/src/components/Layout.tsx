import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { hasPlaceholders, profile } from '../content/profile'
import { buildInfo, commitUrl, isPipelineBuild, shortSha } from '../lib/buildInfo'

function useScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
}

export function Layout() {
  useScrollToHash()
  const commitHref = commitUrl(buildInfo.sha)

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            {profile.name}
          </Link>
          <nav aria-label="Primary">
            <ul className="nav-list">
              <li>
                <Link to="/#about">About</Link>
              </li>
              <li>
                <Link to="/#projects">Projects</Link>
              </li>
              <li>
                <Link to="/#contact">Contact</Link>
              </li>
              <li>
                <NavLink to="/infrastructure">Infrastructure</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {import.meta.env.DEV && hasPlaceholders && (
        <div className="dev-notice" role="note">
          <div className="container">
            Template content: edit <code>frontend/src/content/profile.ts</code> to add your name, links and projects. (This
            notice only appears in local development.)
          </div>
        </div>
      )}

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            © {new Date().getFullYear()} {profile.name}
          </p>
          <p className="footer-build">
            {isPipelineBuild ? (
              <>
                Build{' '}
                {commitHref ? (
                  <a href={commitHref} className="mono">
                    {shortSha(buildInfo.sha)}
                  </a>
                ) : (
                  <span className="mono">{shortSha(buildInfo.sha)}</span>
                )}{' '}
                · deployed by GitHub Actions
              </>
            ) : (
              <>Local build</>
            )}{' '}
            · <Link to="/infrastructure">How this site runs on Azure</Link>
          </p>
        </div>
      </footer>
    </>
  )
}
