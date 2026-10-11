#!/usr/bin/env sh
set -e
TARGET="."
echo "Auditing configuration and source files for weak JWT secrets..."
WEAK_KEYS="secret|password|123456|jwt_secret|mysecret|test|admin|development"
grep -rnE "(JWT_SECRET|SECRET_KEY|token_secret)\s*[:=]\s*["']?()["']?" "" && {
    echo "ERROR: Weak or default JWT key detected!"
    exit 1
} || {
    echo "JWT key configuration clean."
    exit 0
}
