#!/bin/bash
# Build and deploy Pass the Pigs to the nginx bind-mounted dist
# Source: /home/agent/pass-the-pigs (git repo)
# Target: /home/agent/stacks/pass-the-pigs/dist (nginx bind mount)

set -euo pipefail
cd /home/agent/pass-the-pigs

echo "🔨 Building..."
npx vite build

echo "📦 Syncing to nginx dist..."
rsync -av --delete dist/ /home/agent/stacks/pass-the-pigs/dist/

echo "✅ Deployed: $(cat dist/index.html | grep -oP 'assets/index-[^.]+\.js')"
echo "   pigs: https://piggies.rbnk.uk"
echo "   ptp:  https://passthepigs.rbnk.uk"
