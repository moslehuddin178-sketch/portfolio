// Facts about this frontend bundle, injected by GitHub Actions at build time.

const env = import.meta.env

export const buildInfo = {
  sha: env.VITE_GIT_SHA?.trim() || 'local',
  buildTime: env.VITE_BUILD_TIME?.trim() || '',
  repoUrl: (env.VITE_REPO_URL ?? '').trim().replace(/\/+$/, ''),
}

/** True for bundles produced by the CI/CD pipeline, false for local builds. */
export const isPipelineBuild = buildInfo.sha !== 'local'

export function shortSha(sha: string): string {
  return /^[0-9a-f]{40}$/i.test(sha) ? sha.slice(0, 7) : sha
}

export function commitUrl(sha: string): string | undefined {
  return buildInfo.repoUrl && /^[0-9a-f]{7,40}$/i.test(sha) ? `${buildInfo.repoUrl}/commit/${sha}` : undefined
}

/** Link to a file in the repository at the exact commit this site was built from. */
export function sourceUrl(path: string): string | undefined {
  if (!buildInfo.repoUrl) return undefined
  return `${buildInfo.repoUrl}/blob/${isPipelineBuild ? buildInfo.sha : 'main'}/${path}`
}
