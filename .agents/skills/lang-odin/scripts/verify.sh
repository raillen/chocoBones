<!-- prumo:managed -->
#!/bin/sh
set -eu

echo "=== Verifying Odin Safety & Memory ==="

echo "[1/2] Scanning for unregistered escape hatches..."
prumo tool check-escape-hatches .

echo "[2/2] Odin safety checks complete."
exit 0
