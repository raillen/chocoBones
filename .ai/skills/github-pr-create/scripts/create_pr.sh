#!/bin/bash
# scripts/create_pr.sh
# Creates a GitHub Pull Request with a standard template

set -e

TITLE="$1"
BASE_BRANCH="${2:-main}"

if [ -z "$TITLE" ]; then
    echo "Usage: $0 \"<PR Title>\" [base_branch]"
    exit 1
fi

# Ensure we are pushed to remote
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push -u origin "$CURRENT_BRANCH"

# Generate a temporary file for the body
TMP_BODY=$(mktemp)

cat << 'EOF' > "$TMP_BODY"
## Description
<!-- Describe your changes in detail -->

## Related Issues
<!-- e.g. Fixes #123 -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Performed
<!-- How did you test these changes? -->
EOF

echo "Creating PR..."
gh pr create --title "$TITLE" --base "$BASE_BRANCH" --body-file "$TMP_BODY" --draft

rm "$TMP_BODY"
echo "Draft PR created successfully. Please update the description in the UI or via CLI."
