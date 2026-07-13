#!/usr/bin/env bash
# Build the Chrome Web Store / release zip: only the files the extension loads.
set -euo pipefail
cd "$(dirname "$0")"
ver=$(grep -o '"version": *"[^"]*"' manifest.json | head -1 | grep -o '[0-9.]*')
out="wordlens-${ver}.zip"
rm -f "$out"
zip -r "$out" \
  manifest.json background.js content.js content.css \
  icons pages \
  -x '*.DS_Store'
echo "Built $out"
