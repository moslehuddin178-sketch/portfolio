#!/usr/bin/env bash
# Optional: give the API a GitHub token so it can call the GitHub REST API with
# a 5,000 requests/hour limit instead of 60 (shared per outbound IP).
#
# Use a fine-grained personal access token with NO extra permissions
# (public repository data is readable without any scopes).
#
# The token is stored as a Container Apps secret and exposed to the container
# as GITHUB_TOKEN via a secret reference. It never touches Git, the Docker
# image or GitHub Actions. It is read from a hidden prompt so it does not land
# in your shell history.
#
# Usage: ./infra/set-github-token.sh            (uses PREFIX=portfolio naming)
set -euo pipefail

PREFIX="${PREFIX:-portfolio}"
RG="${RESOURCE_GROUP:-rg-${PREFIX}}"
APP="${CONTAINER_APP_NAME:-ca-${PREFIX}-api}"

read -r -s -p "GitHub token for ${APP}: " token
echo
[ -n "$token" ] || { echo "No token entered." >&2; exit 1; }

az containerapp secret set -n "$APP" -g "$RG" --secrets "github-token=${token}" --only-show-errors -o none
unset token
# Referencing the secret creates a new revision that picks up the value.
az containerapp update -n "$APP" -g "$RG" --set-env-vars "GITHUB_TOKEN=secretref:github-token" --only-show-errors -o none
echo "Stored. /api/v1/status will report github.authenticated = true once the new revision is live."
