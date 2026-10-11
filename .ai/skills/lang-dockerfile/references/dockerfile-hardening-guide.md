# Dockerfile Hardening Reference
1. **Non-Root**: Always add a system user: `RUN addgroup -S app && adduser -S app -G app` and set `USER app`.
2. **Build Secrets**: Use `RUN --mount=type=secret,id=token ./fetch_deps.sh` to keep keys out of layers.\n