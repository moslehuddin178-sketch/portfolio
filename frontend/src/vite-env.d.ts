/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Go API on Azure Container Apps. Empty = API not configured. */
  readonly VITE_API_BASE_URL?: string
  /** Commit SHA this bundle was built from (set by GitHub Actions; "local" otherwise). */
  readonly VITE_GIT_SHA?: string
  /** UTC build timestamp (set by GitHub Actions). */
  readonly VITE_BUILD_TIME?: string
  /** https://github.com/<owner>/<repo> (set by GitHub Actions). */
  readonly VITE_REPO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
