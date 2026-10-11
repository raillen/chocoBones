#!/usr/bin/env sh
HOST="127.0.0.1"
PORTS="21 22 80 443 3000 5432 6379 8080 8443"
echo "Scanning target:  for open ports..."
for PORT in ; do
    if command -v nc >/dev/null 2>&1; then
        nc -z -w 1 "" "" 2>/dev/null && echo "  Port : OPEN" || true
    fi
done
echo "Port scan complete."
