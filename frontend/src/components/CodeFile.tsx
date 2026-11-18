import { sourceUrl } from '../lib/buildInfo'

interface CodeFileProps {
  /** Repository-relative path, used for the heading and the GitHub link. */
  path: string
  /** File contents, imported with Vite's `?raw` so this is the real file, not a copy. */
  code: string
  /** Render inside a closed <details> element (for long files). */
  collapsed?: boolean
}

export function CodeFile({ path, code, collapsed = false }: CodeFileProps) {
  const text = code.trimEnd()
  const lines = text.split('\n').length
  const href = sourceUrl(path)

  const meta = (
    <span className="codefile-meta">
      {lines} lines
      {href && (
        <>
          {' · '}
          <a href={href} target="_blank" rel="noreferrer">
            view on GitHub
          </a>
        </>
      )}
    </span>
  )
  const body = (
    <pre className="codefile-pre" tabIndex={0} aria-label={`Contents of ${path}`}>
      <code>{text}</code>
    </pre>
  )

  if (collapsed) {
    return (
      <details className="codefile">
        <summary className="codefile-head">
          <span className="codefile-path">{path}</span>
          {meta}
        </summary>
        {body}
      </details>
    )
  }
  return (
    <figure className="codefile">
      <figcaption className="codefile-head">
        <span className="codefile-path">{path}</span>
        {meta}
      </figcaption>
      {body}
    </figure>
  )
}
