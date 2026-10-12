---
name: lang-typescript
description: TypeScript strict mode, zero 'any', branded types for domain modeling, and runtime schema validation at system boundaries.
---

# TypeScript Strict Soundness Contract

## 1. Strict Compiler Discipline
- `tsconfig.json` must enforce: `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, `"noUncheckedIndexedAccess": true`.
- Prohibit `any`. Use `unknown` with runtime type narrowing or validation.
- `@ts-ignore` and `@ts-nocheck` are prohibited without registered waiver.

## 2. Boundary Schema Validation
- All data entering the process (HTTP requests, environment variables, database results) must be parsed through runtime schema validators (Zod, Valibot, ArkType).
