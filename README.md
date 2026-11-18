# Portfolio on Microsoft Azure

A personal portfolio website with:

- **Frontend:** React + TypeScript (Vite) on **Azure Static Web Apps** (Free plan)
- **Backend (optional):** Go REST API in a Docker container on **Azure Container Apps** (Consumption, scales to zero)
- **CI/CD:** one GitHub Actions workflow that tests, builds, validates the Docker image and deploys both parts
- **Docs:** an `/infrastructure` page with the architecture diagram, services and cost, pipeline, configuration, monitoring, security, and challenges. It embeds the real `Dockerfile` and workflow, and shows live status read from the running deployment.

```
portfolio/
├── frontend/                     React + TypeScript app
│   ├── src/content/profile.ts    ← your name, links, projects (edit this first)
│   ├── src/pages/                Home, Infrastructure, 404
│   └── public/staticwebapp.config.json   SPA routing + security headers
├── backend/                      Go API (standard library only)
│   ├── cmd/api/                  entry point, graceful shutdown, healthcheck
│   ├── internal/                 config, GitHub client + cache, HTTP handlers
│   └── Dockerfile                multi-stage → distroless, non-root, ~4 MB
├── infra/
│   ├── provision.sh              one-time Azure setup (idempotent)
│   └── set-github-token.sh       optional API secret
└── .github/workflows/ci-cd.yml   CI/CD pipeline
```

## 1. Make it yours

Edit [`frontend/src/content/profile.ts`](frontend/src/content/profile.ts): name, role, about text, email, links, projects and experience. Only list real projects and roles. Empty lists hide their section. While placeholders remain, `npm run dev` shows a reminder banner.

## 2. Run locally

Requirements: Node 22+ (24 recommended), Go 1.27+, Docker (optional).

```bash
# API on :8080
cd backend
ALLOWED_ORIGINS=http://localhost:5173 GITHUB_USERNAME=<your-github-username> go run ./cmd/api

# Frontend on :5173 (talks to the local API via .env.development)
cd frontend
npm install
npm run dev
```

Or run the API container: `docker build -t portfolio-api ./backend && docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=http://localhost:5173 portfolio-api`.

Tests and checks (the same ones CI runs):

```bash
cd frontend && npm test && npm run build
cd backend && gofmt -l . && go vet ./... && go test -race ./...
```

## 3. Deploy to Azure

1. **Create a GitHub repository** and push this folder to `main`:
   ```bash
   git init -b main && git add . && git commit -m "Initial portfolio"
   gh repo create <repo-name> --public --source . --push
   ```
2. **Provision Azure** (creates only free or free-tier resources; see costs below):
   ```bash
   az login
   GITHUB_REPO=<owner>/<repo-name> ./infra/provision.sh
   ```
   It prints the GitHub secrets and variables and offers to set them with the GitHub CLI.
   Optional: `LOCATION=southeastasia SWA_LOCATION=eastasia` to deploy closer to you.
3. **Run the pipeline:** push a commit, or *Actions → CI/CD → Run workflow*. The first run creates the container app.
4. **If the API deploy can't pull the image**, open the `portfolio-api` package on GitHub (*Packages*), set its visibility to **Public**, and re-run the job. New GHCR packages start private.
5. **Optional:** `./infra/set-github-token.sh` stores a GitHub token as a Container Apps secret (raises the API's GitHub rate limit).
6. **Custom domain:** add a `CNAME` for `www` → your `*.azurestaticapps.net` hostname, then
   `az staticwebapp hostname set -n swa-portfolio -g rg-portfolio --hostname www.example.com`
   (free managed certificate). Add the new origin to the `ALLOWED_ORIGINS` GitHub variable and re-run the workflow.

After that, every push to `main` deploys the frontend. The API is redeployed only when `backend/` changes. Both deploy jobs wait until the live URL reports the new commit.

## What costs money

| Resource | Plan | Cost |
|---|---|---|
| Azure Static Web Apps | Free | Free (100 GB/month bandwidth, 2 custom domains, free TLS, no SLA) |
| Azure Container Apps | Consumption, 0.25 vCPU / 0.5 GiB, 0–1 replicas | Free up to the monthly grant (180,000 vCPU-s, 360,000 GiB-s, 2M requests per subscription), about 200 replica-hours at this size. Billed per second above that. |
| Container Apps environment | Consumption profile only | No standing charge |
| Log Analytics | Pay-as-you-go, 30-day retention, 0.1 GB/day cap | First 5 GB/month per billing account free, then per GB |
| Entra ID app registration (OIDC) | n/a | Free |
| GitHub Container Registry, GitHub Actions | n/a | Free for public repos and images |

**Not created, to avoid cost:** Azure Container Registry (no free tier), Key Vault, Application Insights, any database, Front Door, Static Web Apps Standard, and always-on replicas.

Also set a budget alert (free) under *Cost Management → Budgets* in the Azure portal. Check current prices with the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/).

## Remove everything

```bash
az group delete -n rg-portfolio --yes
az ad app delete --id "$(az ad app list --display-name gh-portfolio-deploy --query '[0].appId' -o tsv)"
```

## Notes

- The CSP in `staticwebapp.config.json` allows API calls to `https://*.azurecontainerapps.io`. If you put the API on a custom domain, add it to `connect-src`.
- `VITE_*` variables are compiled into public JavaScript. Never put secrets in them.
