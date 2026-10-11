#!/usr/bin/env sh
set -e
URL="http://localhost:8080"
echo "Fuzzing endpoint:  with boundary payloads..."
PAYLOADS="' " <script> alert(1) </script> ../../../../etc/passwd null 0 -1 999999999999999"
for P in ; do
    curl -s -o /dev/null -w "%{http_code}\n" "?q=" || true
done
echo "Fuzz test sequence complete."
