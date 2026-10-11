# Dockerfile Security Checklist
- [ ] Multi-stage build separates build tools from runtime.
- [ ] Unprivileged USER declared (non-root).
- [ ] Base images pinned to version/digest (no :latest).
- [ ] Zero secrets in ARG, ENV, or layers.
- [ ] HEALTHCHECK instruction defined.
- [ ] Hadolint passes with 0 warnings.\n