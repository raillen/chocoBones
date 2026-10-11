# Prumo — chocoBones-std

This is the intent router for humans and agents. Add links as stable documentation is created; do not create empty documentation solely to populate this map.

## Current state

- [Project state](../PROJECT_STATE.md)
- `prumo.json` — canonical project configuration

## I want to use the product

Add user tutorials, how-to guides, reference and explanations under `docs/user/` as needed.

## I want to develop/contribute

Add onboarding, codebase tour, build/test/debug and task-oriented development guides under `docs/developer/`.

## I want to operate/support it

Add deployment, configuration, observability, runbooks, backup/recovery, troubleshooting and release guidance under `docs/operations/` / `docs/support/` as needed.

## I am an AI agent

1. Read the active Goal.
2. Use the smallest sufficient context.
3. Prefer structural/symbol/document-section pointers.
4. Expand only when evidence is insufficient.
5. Keep output bounded.
6. Update only impacted canonical docs.
7. Record evidence/intelligence and garbage-collect temporary context.

## Architecture / decisions / specs

Add stable architecture, ADR/RFC and specifications as the project grows.

## Goals

Goals live under `.ai/goals/<phase>/` and define measurable completion.

## Durable intelligence

Compact project/task intelligence lives in `.prumo/history/project-intelligence.json`.
