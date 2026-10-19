#!/usr/bin/env bash
# Deploy the built site to the self-hosted server.
# Requires an SSH key authorized for the deploy user (default ~/.ssh/aa_deploy).
set -euo pipefail

KEY="${AA_DEPLOY_KEY:-$HOME/.ssh/aa_deploy}"
HOST="${AA_DEPLOY_HOST:-118.196.50.229}"
USER="${AA_DEPLOY_USER:-deploy}"
DIR="${AA_DEPLOY_PATH:-/var/www/awesome-architecture-blog}"

echo "building..."
pnpm build

echo "uploading to $USER@$HOST:$DIR ..."
tar -czf - -C dist . | ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" "
  set -e
  rm -rf /tmp/aa-deploy && mkdir -p /tmp/aa-deploy
  tar -xzf - -C /tmp/aa-deploy
  rsync -a --delete /tmp/aa-deploy/ '$DIR'/
  rm -rf /tmp/aa-deploy
"

echo "deployed to $HOST:$DIR"
