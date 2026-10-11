#!/bin/bash
# scripts/fetch_pr_diff.sh
# Fetches the diff and review comments of a specific PR for analysis.

if [ -z "$1" ]; then
    echo "Usage: $0 <pr_number>"
    exit 1
fi

PR_NUMBER="$1"

echo "=== Pull Request #$PR_NUMBER Summary ==="
gh pr view "$PR_NUMBER"

echo ""
echo "=== Diff ==="
gh pr diff "$PR_NUMBER"

echo ""
echo "=== Review Comments ==="
# Fetch review threads using gh api
gh api \
  -H "Accept: application/vnd.github+json" \
  "/repos/{owner}/{repo}/pulls/$PR_NUMBER/comments" \
  --jq '.[] | "File: \(.path) Line: \(.line)\nUser: \(.user.login)\nComment: \(.body)\n---"'
