#!/usr/bin/env bash

# Script to find print statements that should probably be logging statements
# Usage: ./check_log_levels.sh <directory>

DIR=${1:-"."}

echo "Scanning $DIR for raw print() statements..."

# Find Python files and search for 'print(' but ignore lines containing 'import' or starting with '#'
# This is a rudimentary check; a real AST parser is better.
RESULTS=$(find "$DIR" -name "*.py" -type f | xargs grep -n "print(" | grep -v "[[:space:]]*#" | grep -v "def .*print(")

if [ -n "$RESULTS" ]; then
    echo "WARNING: Found raw print() statements. Use structured logging instead."
    echo "$RESULTS"
    exit 1
else
    echo "SUCCESS: No raw print() statements found."
    exit 0
fi
