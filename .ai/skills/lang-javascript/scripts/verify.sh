#!/bin/sh
set -eu
echo "=== Verifying Modern JavaScript ES2024+ & Security Discipline ==="
prumo tool check-escape-hatches .
exit 0
