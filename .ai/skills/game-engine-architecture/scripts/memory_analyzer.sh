#!/usr/bin/env sh
TARGET="."
echo "Analyzing asset and binary memory footprint in ..."
find "" -type f -exec du -h {} + | sort -hr | head -n 20
