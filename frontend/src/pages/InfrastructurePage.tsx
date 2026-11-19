import type { ReactNode } from 'react'
import dockerfile from '../../../backend/Dockerfile?raw'
import workflow from '../../../.github/workflows/ci-cd.yml?raw'
import provisionScript from '../../../infra/provision.sh?raw'
import { ArchitectureDiagram } from '../components/ArchitectureDiagram'
import { CodeFile } from '../components/CodeFile'
import { LiveStatus } from '../components/LiveStatus'
import { profile } from '../content/profile'

// The three files above are imported with `?raw`: what you read on this page is
// the configuration that built and deployed it, not a hand-written copy.

const sections = [
  { id: 'status', title: 'Live deployment status' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'services', title: 'Azure services and cost' },
  { id: 'workflow', title: 'Deployment workflow' },
  { id: 'docker', title: 'Docker configuration' },
  { id: 'pipeline', title: 'CI/CD pipeline' },
  { id: 'environment', title: 'Environment configuration' },
  { id: 'monitoring', title: 'Monitoring and logging' },
  { id: 'security', title: 'Security considerations' },
  { id: 'challenges', title: 'Deployment challenges and solutions' },
] as const

type SectionId = (typeof sections)[number]['id']

function DocSection({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = sections.find((s) => s.id === id)?.title
  return (
    <section id={id} className="doc-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}

function Table({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={caption ?? head.join(', ')}>
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const C = ({ children }: { children: ReactNode }) => <code>{children}</code>

const serviceRows: ReactNode[][] = [
  [
    'Azure Static Web Apps',
    'Serves the React build worldwide; custom domain with a free, auto-renewing TLS certificate.',
    'Free plan',
    <><span className="cost cost-free">Free</span> 100 GB bandwidth/month, 2 custom domains, no SLA. The Standard plan is paid.</>,
  ],
  [
    'Azure Container Apps',
    'Runs the Go API container. Scales to zero replicas when idle.',
    'Consumption profile · 0.25 vCPU / 0.5 GiB · 0–1 replicas',
    <><span className="cost cost-grant">Free grant</span> 180,000 vCPU-s, 360,000 GiB-s and 2 million requests per subscription per month; usage above that is billed per second.</>,
  ],
  [
    'Container Apps environment',
    'Shared boundary, networking and log routing for the container app. Shared with another of my projects, because the subscription allows only one environment.',
    'Workload-profiles environment, Consumption profile only',
    <><span className="cost cost-free">No standing charge</span> while no Dedicated profiles are added.</>,
  ],
  [
    'Log Analytics workspace',
    'Stores the API’s console logs and Container Apps system logs.',
    'Pay-as-you-go · 30-day retention · daily cap',
    <><span className="cost cost-grant">Free allowance</span> first 5 GB ingested per billing account per month, 31 days retention included; billed per GB beyond that.</>,
  ],
  [
    'Microsoft Entra ID app registration',
    'Identity that GitHub Actions signs in as, via OIDC federation.',
    'n/a',
    <><span className="cost cost-free">Free</span></>,
  ],
]

const notUsedRows: ReactNode[][] = [
  ['Azure Container Registry', 'No free tier (billed daily). Images go to GitHub Container Registry, which is free for public images.'],
  ['Azure Key Vault', 'One optional token is stored as a Container Apps secret, which is encrypted at rest and enough at this scale.'],
  ['Application Insights', 'Billed per GB ingested. Structured logs plus platform metrics cover a personal site.'],
  ['A database', 'Nothing needs to be persisted. GitHub data is cached in memory.'],
  ['Static Web Apps Standard plan', 'Only needed for an SLA, more custom domains or linked backends; the API is called directly instead.'],
  ['Minimum replicas ≥ 1', 'An always-on replica runs ~730 h/month, well beyond the ~200 h the free grant covers at this size.'],
]

const pipelineJobs = [
  {
    job: 'changes',
    title: 'Detect changes',
    when: 'Every run',
    steps: ['dorny/paths-filter checks whether anything under backend/ changed'],
  },
  {
    job: 'frontend',
    title: 'Frontend · test & build',
    when: 'Every run',
    steps: ['npm ci from the lockfile', 'Vitest unit tests', 'tsc type-check + Vite production build', 'Upload dist/ as an artifact'],
  },
  {
    job: 'backend',
    title: 'Backend · vet, test & build',
    when: 'Every run',
    steps: ['gofmt check', 'go vet', 'go test -race', 'go build'],
  },
  {
    job: 'image',
    title: 'Docker · build & validate',
    when: 'Every run; pushes only on main when backend/ changed',
    steps: [
      'Buildx build with the GitHub Actions layer cache',
      'Assert non-root user and size < 50 MiB',
      'Run the container: /healthz, commit in /api/v1/status, CORS header',
      'Push ghcr.io/<owner>/portfolio-api:<sha>',
    ],
  },
  {
    job: 'deploy-frontend',
    title: 'Deploy frontend',
    when: 'Push to main',
    steps: ['Upload the already-tested dist/ to Static Web Apps', 'Poll the live site until its build-sha meta tag equals this commit'],
  },
  {
    job: 'deploy-backend',
    title: 'Deploy backend',
    when: 'Push to main and backend/ changed (or manual run)',
    steps: [
      'azure/login with OIDC: no stored password',
      'az containerapp create (first run) or update --image :<sha>',
      'Poll /api/v1/status until the live commit equals this commit',
    ],
  },
]

export default function InfrastructurePage() {
  return (
    <div className="container doc-layout">
      <title>{`Azure architecture · ${profile.name}`}</title>

      <header className="doc-header">
        <p className="eyebrow">Infrastructure</p>
        <h1>How this site is built and deployed on Azure</h1>
        <p className="lede">
          A React + TypeScript frontend on Azure Static Web Apps and a Go REST API in a Docker container on Azure
          Container Apps, shipped by a GitHub Actions pipeline. The configuration files on this page are the real ones
          from the repository, embedded at build time, and the status panel below is read live from the running
          deployment.
        </p>
      </header>

      <nav className="toc" aria-label="On this page">
        <p className="toc-title">On this page</p>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="doc-body">
        <DocSection id="status">
          <p>
            Both values come from the running system: the frontend commit is compiled into this bundle by the pipeline,
            and the API card calls <C>GET /api/v1/status</C>, which reports the commit baked into the Docker image and
            the revision and replica names that Azure Container Apps injects into the container. The API is only
            redeployed when <C>backend/</C> changes, so its commit can be older than the frontend’s.
          </p>
          <LiveStatus />
        </DocSection>

        <DocSection id="architecture">
          <ArchitectureDiagram />
          <ul className="plain-list">
            <li>
              <strong>Frontend.</strong> Static files from <C>vite build</C> served by Static Web Apps. Routing is
              client-side; <C>staticwebapp.config.json</C> rewrites unknown paths to <C>index.html</C> and sets the
              security headers.
            </li>
            <li>
              <strong>API.</strong> A dependency-free Go service using only the standard library (<C>net/http</C>,{' '}
              <C>log/slog</C>). It is optional: if <C>API_BASE_URL</C> is not set, the site still works and the live
              sections are hidden.
            </li>
            <li>
              <strong>Data.</strong> No database. The API reads public repositories from the GitHub REST API and caches
              them in memory for 15 minutes.
            </li>
            <li>
              <strong>Delivery.</strong> GitHub Actions builds once, tests what it built, and deploys that exact
              artifact. Images are tagged with the commit SHA, so every Container Apps revision maps to one commit.
            </li>
          </ul>
        </DocSection>

        <DocSection id="services">
          <p>
            Everything lives in one resource group (<C>rg-portfolio</C>), so <C>az group delete -n rg-portfolio</C>{' '}
            removes all of it. Prices and allowances are from Microsoft’s pricing pages at the time of writing. Check
            the{' '}
            <a href="https://azure.microsoft.com/pricing/calculator/" target="_blank" rel="noreferrer">
              Azure pricing calculator
            </a>{' '}
            for your region.
          </p>
          <Table caption="Azure resources in use" head={['Service', 'Used for', 'Plan / size', 'Cost']} rows={serviceRows} />

          <h3>What could cost money</h3>
          <ul className="plain-list">
            <li>
              <strong>Container Apps</strong>, only beyond the monthly free grant. At 0.25 vCPU / 0.5 GiB the grant
              covers about 200 hours of replica run time a month (180,000 ÷ 0.25 and 360,000 ÷ 0.5 seconds). With{' '}
              <C>--min-replicas 0</C> the app only runs while it is serving traffic, and <C>--max-replicas 1</C>{' '}
              caps the worst case.
            </li>
            <li>
              <strong>Log Analytics</strong>, only beyond 5 GB/month. The workspace has a daily cap, health probes are
              not logged, and each request produces one short JSON line.
            </li>
            <li>
              <strong>GitHub Actions</strong> (not Azure): free on public repositories; private repositories use the
              account’s included minutes.
            </li>
          </ul>
          <p>
            Set a monthly budget with an email alert under <em>Cost Management → Budgets</em> in the Azure portal.
            Budgets are free and warn you before a surprise bill.
          </p>

          <h3>Deliberately not created</h3>
          <Table head={['Service', 'Why not']} rows={notUsedRows} />
        </DocSection>

        <DocSection id="workflow">
          <h3>One-time setup</h3>
          <ol className="steps">
            <li>
              Create a GitHub repository and push this project to <C>main</C>.
            </li>
            <li>
              Run <C>GITHUB_REPO=&lt;owner&gt;/&lt;repo&gt; ./infra/provision.sh</C> after <C>az login</C>. It creates
              the resource group, Log Analytics workspace, Container Apps environment and a Free Static Web App, plus an
              Entra ID app registration that trusts GitHub’s OIDC tokens for this repository’s <C>main</C> branch only.
              With <C>EXISTING_ENVIRONMENT_ID</C> set, it reuses an existing environment (and its workspace) instead.
            </li>
            <li>
              Let the script set the GitHub secrets and variables it prints (it uses the GitHub CLI if you are signed
              in).
            </li>
            <li>
              Run the workflow (push or <em>Run workflow</em>). The first backend deploy creates the container app.
            </li>
            <li>
              If the first API deploy can’t pull the image, make the <C>portfolio-api</C> package public in GitHub (it
              starts private) and re-run the job.
            </li>
          </ol>

          <h3>Every push to main</h3>
          <ol className="steps">
            <li>GitHub Actions tests and builds the frontend and the Go API in parallel.</li>
            <li>The Docker image is built and started in the runner to check that it is healthy.</li>
            <li>The tested <C>dist/</C> folder is uploaded to Static Web Apps with the deployment token.</li>
            <li>
              If <C>backend/</C> changed, the image is pushed to <C>ghcr.io</C> tagged with the commit SHA, and the
              container app is updated to that tag, which creates a new revision. Single-revision mode moves all
              traffic to it once it is healthy.
            </li>
            <li>Both deploy jobs poll the live URLs until they report the new commit, or the run fails.</li>
          </ol>

          <h3>Custom domain and HTTPS</h3>
          <ol className="steps">
            <li>
              At your DNS provider, add a <C>CNAME</C> record for <C>www</C> pointing at the Static Web App’s default
              hostname (<C>*.azurestaticapps.net</C>).
            </li>
            <li>
              Run <C>az staticwebapp hostname set -n swa-portfolio -g rg-portfolio --hostname www.example.com</C>. Azure
              validates the record and issues a free managed certificate. For an apex domain, use{' '}
              <C>--validation-method dns-txt-token</C> and an ALIAS/ANAME record.
            </li>
            <li>
              Add the new origin to the <C>ALLOWED_ORIGINS</C> variable (comma-separated) and run the workflow manually
              so the API accepts requests from it.
            </li>
          </ol>
          <p>
            HTTPS is automatic on both services: Static Web Apps and Container Apps ingress terminate TLS with managed
            certificates and redirect plain HTTP.
          </p>

          <h3>Rollback</h3>
          <p>
            API: point the app back at a previous immutable tag:{' '}
            <C>az containerapp update -n ca-portfolio-api -g rg-portfolio --image ghcr.io/&lt;owner&gt;/portfolio-api:&lt;previous-sha&gt;</C>
            . Frontend: <C>git revert</C> and push; the pipeline redeploys in a few minutes.
          </p>

          <CodeFile path="infra/provision.sh" code={provisionScript} collapsed />
        </DocSection>

        <DocSection id="docker">
          <p>A two-stage build produces a static Go binary in a distroless image of about 4 MB.</p>
          <ul className="plain-list">
            <li>
              <strong>Build stage</strong> (<C>golang:1.27-alpine</C>): <C>CGO_ENABLED=0</C>, <C>-trimpath</C>,{' '}
              <C>-s -w</C>; the commit SHA and build time are stamped in with <C>-ldflags -X</C>.
            </li>
            <li>
              <strong>Runtime stage</strong> (<C>distroless/static:nonroot</C>): no shell or package manager, runs as
              UID 65532.
            </li>
            <li>
              <strong>Health check</strong>: the binary probes itself (<C>/api healthcheck</C>) because there is no
              curl in the image. Container Apps uses its own probes on the ingress port.
            </li>
            <li>
              <strong>Cache-friendly</strong>: <C>go.mod</C> is copied before the source, and CI reuses layers through
              the GitHub Actions cache.
            </li>
          </ul>
          <CodeFile path="backend/Dockerfile" code={dockerfile} />
          <p>Run it locally:</p>
          <pre className="snippet" tabIndex={0}>
            <code>{`docker build -t portfolio-api ./backend
docker run --rm -p 8080:8080 \\
  -e ALLOWED_ORIGINS=http://localhost:5173 \\
  -e GITHUB_USERNAME=<your-github-username> \\
  portfolio-api
curl localhost:8080/api/v1/status`}</code>
          </pre>
        </DocSection>

        <DocSection id="pipeline">
          <p>
            One workflow, <C>.github/workflows/ci-cd.yml</C>. Pull requests run every check but never deploy. Pushes to{' '}
            <C>main</C> deploy the frontend every time and the API only when <C>backend/</C> changed.
          </p>
          <ol className="pipeline">
            {pipelineJobs.map((j) => (
              <li key={j.job} className="card pipeline-job">
                <p className="pipeline-name">
                  <code>{j.job}</code>
                </p>
                <h3>{j.title}</h3>
                <p className="pipeline-when">{j.when}</p>
                <ul>
                  {j.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p>
            Both deploy jobs wait for all tests and the image check to pass. Permissions are read-only by default;
            only the image job can write packages, and only the backend deploy job can request an OIDC token.
          </p>
          <CodeFile path=".github/workflows/ci-cd.yml" code={workflow} collapsed />
        </DocSection>

        <DocSection id="environment">
          <p>
            Configuration is split by who can see it. Anything prefixed <C>VITE_</C> is compiled into public JavaScript,
            so it never holds a secret.
          </p>
          <Table
            caption="Frontend (build time, public)"
            head={['Variable', 'Purpose', 'Source']}
            rows={[
              [<C>VITE_API_BASE_URL</C>, 'Base URL of the Go API. Empty hides the live sections.', <>GitHub variable <C>API_BASE_URL</C>; <C>.env.development</C> locally</>],
              [<C>VITE_GIT_SHA</C>, 'Commit shown in the footer and status panel; checked after deploy.', <>Workflow (<C>github.sha</C>)</>],
              [<C>VITE_BUILD_TIME</C>, 'Build timestamp.', 'Workflow'],
              [<C>VITE_REPO_URL</C>, 'Links commits and files to GitHub.', 'Workflow'],
            ]}
          />
          <Table
            caption="Backend (runtime, on Azure Container Apps)"
            head={['Variable', 'Purpose', 'Source']}
            rows={[
              [<C>PORT</C>, 'Listen port (8080).', 'Dockerfile default'],
              [<C>APP_ENV</C>, 'Environment name reported by /status.', 'Dockerfile / deploy job'],
              [<C>ALLOWED_ORIGINS</C>, 'Exact origins allowed by CORS; wildcards are rejected at startup.', <>GitHub variable, re-applied on each deploy</>],
              [<C>GITHUB_USERNAME</C>, 'Account whose public repositories are listed.', <>GitHub variable <C>PROFILE_GITHUB_USERNAME</C> (defaults to the repo owner)</>],
              [<C>GITHUB_TOKEN</C>, <><strong>Secret.</strong> Optional; raises the GitHub rate limit.</>, <>Container Apps secret <C>github-token</C> via <C>secretref:</C>. Set with <C>infra/set-github-token.sh</C>; never in Git or CI.</>],
              [<C>GITHUB_CACHE_TTL</C>, 'How long repositories are cached (default 15m).', 'Optional'],
              [<C>CONTAINER_APP_*</C>, 'App, revision and replica names.', 'Injected by Azure'],
            ]}
          />
          <Table
            caption="GitHub Actions settings"
            head={['Name', 'Kind', 'Value']}
            rows={[
              [<C>AZURE_CLIENT_ID</C>, 'Secret', 'Entra app registration (OIDC). Not a password.'],
              [<C>AZURE_TENANT_ID</C>, 'Secret', 'Entra tenant'],
              [<C>AZURE_SUBSCRIPTION_ID</C>, 'Secret', 'Target subscription'],
              [<C>AZURE_STATIC_WEB_APPS_API_TOKEN</C>, 'Secret', 'Static Web Apps deployment token'],
              [<C>AZURE_RESOURCE_GROUP</C>, 'Variable', <C>rg-portfolio</C>],
              [<C>AZURE_CONTAINERAPPS_ENVIRONMENT</C>, 'Variable', <><C>cae-portfolio</C>, or a shared environment’s resource ID</>],
              [<C>AZURE_CONTAINER_APP_NAME</C>, 'Variable', <C>ca-portfolio-api</C>],
              [<C>API_BASE_URL</C>, 'Variable', <C>https://ca-portfolio-api.&lt;env-domain&gt;</C>],
              [<C>ALLOWED_ORIGINS</C>, 'Variable', 'Static Web App URL and any custom domains'],
            ]}
          />
        </DocSection>

        <DocSection id="monitoring">
          <Table
            head={['Signal', 'Where it goes', 'Use it for']}
            rows={[
              ['API request logs (one JSON line per request: method, path, status, bytes, duration)', <C>ContainerAppConsoleLogs_CL</C>, 'Traffic, errors, latency'],
              ['Startup log (configuration summary; secrets reported as present/absent only)', <C>ContainerAppConsoleLogs_CL</C>, 'Checking a revision’s settings'],
              ['Revision provisioning, scaling, image-pull and probe events', <C>ContainerAppSystemLogs_CL</C>, 'Diagnosing failed deploys and cold starts'],
              ['Requests, replica count, CPU, memory, restarts', 'Azure Monitor platform metrics (free)', 'Charts and alerts'],
              ['Deploy verification', 'GitHub Actions run logs', 'Proving which commit is live'],
            ]}
          />
          <p>Stream logs from a terminal:</p>
          <pre className="snippet" tabIndex={0}>
            <code>{`az containerapp logs show -n ca-portfolio-api -g rg-portfolio --follow --tail 50
az containerapp logs show -n ca-portfolio-api -g rg-portfolio --type system`}</code>
          </pre>
          <p>Hourly traffic and p95 latency in Log Analytics (KQL):</p>
          <pre className="snippet" tabIndex={0}>
            <code>{`ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "ca-portfolio-api"
| extend e = parse_json(Log_s)
| where tostring(e.msg) == "request"
| summarize requests = count(),
            errors = countif(toint(e.status) >= 500),
            p95_ms = percentile(toint(e.duration_ms), 95)
  by bin(TimeGenerated, 1h)`}</code>
          </pre>
          <p>
            Log costs are kept down by a 30-day retention period, a 0.1 GB daily cap, not logging <C>/healthz</C>, and not
            logging client IP addresses (which also keeps visitor data out of the logs). The Free Static Web Apps plan
            has no request logging; adding Application Insights would cost money and isn’t needed at this scale.
          </p>
        </DocSection>

        <DocSection id="security">
          <ul className="plain-list">
            <li>
              <strong>No long-lived Azure credentials in GitHub.</strong> Deploys sign in with OIDC workload identity
              federation. The federated credential only trusts <C>repo:&lt;owner&gt;/&lt;repo&gt;:ref:refs/heads/main</C>,
              and the identity is <em>Contributor</em> on this one resource group, not the subscription.
            </li>
            <li>
              <strong>Secrets live where they are used.</strong> The optional GitHub token is a Container Apps secret
              referenced with <C>secretref:</C>; it is not in the repository, the image or the pipeline. The API reports
              only whether a token is present. The Static Web Apps deployment token is an encrypted GitHub secret and
              can be rotated with <C>az staticwebapp secrets reset-api-key</C>.
            </li>
            <li>
              <strong>Public build variables are treated as public.</strong> Only URLs and commit metadata use the{' '}
              <C>VITE_</C> prefix.
            </li>
            <li>
              <strong>Strict CORS.</strong> The API accepts browser calls only from the exact origins in{' '}
              <C>ALLOWED_ORIGINS</C>; malformed or wildcard entries stop it from starting.
            </li>
            <li>
              <strong>Hardened container.</strong> Distroless base, non-root user, no shell, static binary, immutable
              SHA tags. CI fails the build if the image runs as root.
            </li>
            <li>
              <strong>Hardened HTTP server.</strong> Read, write and idle timeouts (against slow-client attacks), a
              64 KB header limit, panic recovery, input validation of the GitHub username, and a JSON-only API with{' '}
              <C>default-src &apos;none&apos;</C> CSP.
            </li>
            <li>
              <strong>Browser security headers</strong> from <C>staticwebapp.config.json</C>: Content-Security-Policy
              (scripts and styles from this origin only; API calls only to <C>*.azurecontainerapps.io</C>), HSTS,
              X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy.
            </li>
            <li>
              <strong>HTTPS everywhere</strong> with platform-managed certificates on both services.
            </li>
            <li>
              <strong>Least-privilege pipeline.</strong> Read-only token by default; pull requests (including from
              forks) can’t reach deploy jobs or secrets.
            </li>
            <li>
              <strong>Small supply chain.</strong> The API has no third-party Go modules; the frontend installs with{' '}
              <C>npm ci</C> from a lockfile.
            </li>
            <li>
              <strong>Database.</strong> None, so there is no stored data to breach. If one is added later, connect
              with a managed identity (or a Container Apps secret / Key Vault reference) and require TLS. Credentials
              never go in source code.
            </li>
          </ul>
        </DocSection>

        <DocSection id="challenges">
          <p>
            These are problems this architecture has to deal with, and how this repository handles each one.
          </p>
          <Table
            head={['Challenge', 'Solution in this repository']}
            rows={[
              [
                'Refreshing a deep link such as /infrastructure returns 404 on a static host.',
                <><C>navigationFallback</C> in <C>staticwebapp.config.json</C> rewrites unknown paths to <C>index.html</C>.</>,
              ],
              [
                'The Free Static Web Apps plan can’t link a backend (that needs Standard).',
                'The browser calls the Container App directly over HTTPS; the API allows only known origins and the CSP allows only that API host.',
              ],
              [
                'Scale-to-zero means the first request after idle waits for a cold start.',
                'The UI explains the wait after 2.5 s and allows 25 s before timing out, with a retry button. Setting min replicas to 1 removes cold starts but costs money.',
              ],
              [
                'The frontend needs the API URL at build time, before the API exists.',
                'The URL is predictable (<app>.<environment default domain>), so the provisioning script computes it in advance; the first pipeline run creates the app.',
              ],
              [
                'The subscription allows only one Container Apps environment, and another project already uses it.',
                'The provisioning script can reuse an existing environment. The API keeps its own resource group, and on the shared environment the deploy identity has only the Container Apps Operator role: it can add apps but not change or delete the environment.',
              ],
              [
                'New GitHub Container Registry packages are private, so Azure can’t pull them.',
                'Make the package public once (free), or add registry credentials with a read:packages token stored as a Container Apps secret.',
              ],
              [
                'Storing an Azure service-principal password in GitHub is a long-lived secret.',
                'OIDC federated credentials: GitHub exchanges a short-lived token; nothing to leak or rotate.',
              ],
              [
                'The first Azure login failed: GitHub’s token subject includes the owner and repository IDs (repo:<owner>@<id>/<repo>@<id>:…), so a credential for repo:<owner>/<repo> never matched.',
                'The provisioning script looks up both IDs from the GitHub API and trusts that exact subject. A deleted and re-created repository with the same name can’t reuse it.',
              ],
              [
                'Unauthenticated GitHub API calls are limited to 60 per hour per IP, and outbound IPs are shared.',
                'A 15-minute in-memory cache, stale-on-error fallback, and an optional token secret (5,000 per hour).',
              ],
              [
                'Health probes and verbose logs can quietly use up the Log Analytics allowance.',
                '/healthz is not logged, logs are one line per request, retention is 30 days and there is a daily cap.',
              ],
              [
                'Redeploying the API when only the frontend changed wastes time and creates revisions for nothing.',
                'A paths filter; the API is deployed only when backend/ changes (or on a manual run).',
              ],
              [
                'A green pipeline doesn’t prove the new version is live.',
                'Both deploy jobs poll the live endpoints until they report this commit SHA, and fail otherwise.',
              ],
            ]}
          />
          <p className="callout">
            When you hit a real problem while deploying, write it up here: the symptom, the cause and the fix. A real
            incident shows more than any list of planned solutions.
          </p>
        </DocSection>
      </div>
    </div>
  )
}
