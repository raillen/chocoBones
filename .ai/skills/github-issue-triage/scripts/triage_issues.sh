#!/usr/bin/env sh
set -e
echo "Fetching untriaged GitHub issues..."
if command -v gh >/dev/null 2>&1; then
    exec gh issue list --state open --limit 25
else
    echo "GitHub CLI (gh) not installed. Please install gh to triage issues."
    exit 1
fi
