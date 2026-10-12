#!/bin/sh
set -eu
echo "=== Verifying TypeScript Strict Soundness & Boundary Schemas ==="
prumo tool check-escape-hatches .
exit 0
