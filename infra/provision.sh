#!/usr/bin/env bash
# One-time Azure setup for the portfolio. Safe to re-run (idempotent).
#
# Creates ONLY what the site needs:
#   - Resource group
#   - Azure Static Web Apps (Free plan)                       -> free
#   - Log Analytics workspace (30-day retention, daily cap)   -> free up to 5 GB/month per billing account
#   - Container Apps environment (Consumption)                -> no standing charge
#     (both skipped when EXISTING_ENVIRONMENT_ID is set, see below)
#   - Entra ID app registration + GitHub OIDC credential      -> free
# The container app itself is created by the first GitHub Actions deploy.
#
# Deliberately NOT created: Azure Container Registry (no free tier; ghcr.io is
# used instead), Key Vault, Application Insights, databases, Front Door.
#
# Usage:
#   az login
#   GITHUB_REPO=<owner>/<repo> ./infra/provision.sh
#
# Optional overrides: PREFIX (default portfolio), LOCATION (default eastus2),
# SWA_LOCATION (default eastus2; Static Web Apps only supports a few regions:
# westus2, centralus, eastus2, westeurope, eastasia), LOG_DAILY_CAP_GB (default 0.1).
#
# EXISTING_ENVIRONMENT_ID: resource ID of a Container Apps environment to reuse
# instead of creating one. Some subscriptions (student, trial) allow only one
# environment. The app still gets its own resource group, the environment's
# own Log Analytics workspace receives the logs, and the deploy identity may
# only add apps to that environment, not change or delete it. Get the ID with:
#   az containerapp env show -n <name> -g <resource-group> --query id -o tsv
set -euo pipefail

: "${GITHUB_REPO:?Set GITHUB_REPO=<owner>/<repo> (the GitHub repository that will deploy)}"
PREFIX="${PREFIX:-portfolio}"
LOCATION="${LOCATION:-eastus2}"
SWA_LOCATION="${SWA_LOCATION:-eastus2}"
LOG_DAILY_CAP_GB="${LOG_DAILY_CAP_GB:-0.1}"
EXISTING_ENVIRONMENT_ID="${EXISTING_ENVIRONMENT_ID:-}"

RG="rg-${PREFIX}"
LAW="log-${PREFIX}"
CAE="cae-${PREFIX}"
APP="ca-${PREFIX}-api"
SWA="swa-${PREFIX}"
ENTRA_APP="gh-${PREFIX}-deploy"

az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
echo "Subscription: $(az account show --query name -o tsv) ($SUBSCRIPTION_ID)"

# GitHub's OIDC token names the repository by login AND immutable ID
# (repo:<owner>@<owner-id>/<repo>@<repo-id>:ref:...), so look both up now.
# This also stops a deleted and re-created repository of the same name from
# inheriting the Azure trust.
GH_IDS="$(az rest --method get --skip-authorization-header --url "https://api.github.com/repos/${GITHUB_REPO}" \
  --query "join('@', [owner.login, to_string(owner.id), name, to_string(id)])" -o tsv 2> /dev/null)" \
  || { echo "GitHub repository ${GITHUB_REPO} not found: create it (public) first." >&2; exit 1; }
IFS=@ read -r GH_OWNER GH_OWNER_ID GH_REPO GH_REPO_ID <<< "$GH_IDS"
OIDC_SUBJECT="repo:${GH_OWNER}@${GH_OWNER_ID}/${GH_REPO}@${GH_REPO_ID}:ref:refs/heads/main"

echo "==> Registering resource providers (no cost)"
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.Web; do
  az provider register --namespace "$ns" --wait --only-show-errors
done

echo "==> Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" --tags app="$PREFIX" -o none

if [ -n "$EXISTING_ENVIRONMENT_ID" ]; then
  echo "==> Reusing Container Apps environment ${EXISTING_ENVIRONMENT_ID##*/}"
  CAE="$EXISTING_ENVIRONMENT_ID" # the deploy job accepts a name in $RG or a full resource ID
  ENV_DOMAIN="$(az containerapp env show --ids "$CAE" --query properties.defaultDomain -o tsv)"
else
  echo "==> Log Analytics workspace $LAW (30-day retention, ${LOG_DAILY_CAP_GB} GB/day cap)"
  az monitor log-analytics workspace create -g "$RG" -n "$LAW" -l "$LOCATION" \
    --retention-time 30 --quota "$LOG_DAILY_CAP_GB" --only-show-errors -o none
  LAW_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query customerId -o tsv)"
  LAW_KEY="$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LAW" --query primarySharedKey -o tsv)"

  echo "==> Container Apps environment $CAE"
  if ! az containerapp env show -n "$CAE" -g "$RG" --only-show-errors > /dev/null 2>&1; then
    az containerapp env create -n "$CAE" -g "$RG" -l "$LOCATION" \
      --logs-destination log-analytics --logs-workspace-id "$LAW_ID" --logs-workspace-key "$LAW_KEY" \
      --only-show-errors -o none
  fi
  ENV_DOMAIN="$(az containerapp env show -n "$CAE" -g "$RG" --query properties.defaultDomain -o tsv)"
fi
# The API's URL is predictable before the app exists: https://<app>.<environment default domain>
API_URL="https://${APP}.${ENV_DOMAIN}"

echo "==> Static Web App $SWA (Free plan, $SWA_LOCATION)"
if ! az staticwebapp show -n "$SWA" -g "$RG" --only-show-errors > /dev/null 2>&1; then
  az staticwebapp create -n "$SWA" -g "$RG" -l "$SWA_LOCATION" --sku Free --only-show-errors -o none
fi
SITE_URL="https://$(az staticwebapp show -n "$SWA" -g "$RG" --query defaultHostname -o tsv)"
SWA_TOKEN="$(az staticwebapp secrets list -n "$SWA" -g "$RG" --query properties.apiKey -o tsv)"

echo "==> Entra ID app registration $ENTRA_APP with GitHub OIDC federation"
CLIENT_ID="$(az ad app list --display-name "$ENTRA_APP" --query '[0].appId' -o tsv)"
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(az ad app create --display-name "$ENTRA_APP" --query appId -o tsv)"
fi
SP_OBJECT_ID="$(az ad sp show --id "$CLIENT_ID" --query id -o tsv 2> /dev/null || az ad sp create --id "$CLIENT_ID" --query id -o tsv)"

# Only workflow runs on the main branch of this repository can request a token.
if [ -z "$(az ad app federated-credential list --id "$CLIENT_ID" --query "[?subject=='${OIDC_SUBJECT}'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"github-main-${GH_REPO_ID}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${OIDC_SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
fi

assign_role() { # <role> <scope>; new service principals can take a moment to replicate
  for attempt in 1 2 3 4 5 6; do
    if az role assignment create --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
      --role "$1" --scope "$2" --only-show-errors -o none 2> /dev/null; then
      return 0
    fi
    [ "$attempt" -eq 6 ] && { echo "Role assignment ($1) failed; re-run this script." >&2; exit 1; }
    sleep 10
  done
}

# Contributor on this resource group only (not the subscription).
assign_role Contributor "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG}"
if [ -n "$EXISTING_ENVIRONMENT_ID" ]; then
  # On the shared environment: read it and add apps to it, nothing more.
  assign_role "Container Apps Operator" "$EXISTING_ENVIRONMENT_ID"
fi

cat << EOF

==============================================================================
Azure resources are ready.

  Static Web App URL : ${SITE_URL}
  API URL (after the first deploy) : ${API_URL}

Configure the GitHub repository ${GITHUB_REPO}:

  Secrets
    AZURE_CLIENT_ID                   ${CLIENT_ID}
    AZURE_TENANT_ID                   ${TENANT_ID}
    AZURE_SUBSCRIPTION_ID             ${SUBSCRIPTION_ID}
    AZURE_STATIC_WEB_APPS_API_TOKEN   (deployment token, hidden)

  Variables
    AZURE_RESOURCE_GROUP              ${RG}
    AZURE_CONTAINERAPPS_ENVIRONMENT   ${CAE}
    AZURE_CONTAINER_APP_NAME          ${APP}
    API_BASE_URL                      ${API_URL}
    ALLOWED_ORIGINS                   ${SITE_URL}
==============================================================================
EOF

if command -v gh > /dev/null && gh auth status > /dev/null 2>&1; then
  read -r -p "Set these secrets and variables on ${GITHUB_REPO} now with the GitHub CLI? [y/N] " answer
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    gh secret set AZURE_CLIENT_ID --repo "$GITHUB_REPO" --body "$CLIENT_ID"
    gh secret set AZURE_TENANT_ID --repo "$GITHUB_REPO" --body "$TENANT_ID"
    gh secret set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID"
    printf '%s' "$SWA_TOKEN" | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo "$GITHUB_REPO"
    gh variable set AZURE_RESOURCE_GROUP --repo "$GITHUB_REPO" --body "$RG"
    gh variable set AZURE_CONTAINERAPPS_ENVIRONMENT --repo "$GITHUB_REPO" --body "$CAE"
    gh variable set AZURE_CONTAINER_APP_NAME --repo "$GITHUB_REPO" --body "$APP"
    gh variable set API_BASE_URL --repo "$GITHUB_REPO" --body "$API_URL"
    gh variable set ALLOWED_ORIGINS --repo "$GITHUB_REPO" --body "$SITE_URL"
    echo "Done. Push to main (or run the workflow manually) to deploy."
  fi
else
  echo "Get the deployment token with:"
  echo "  az staticwebapp secrets list -n $SWA -g $RG --query properties.apiKey -o tsv"
fi
