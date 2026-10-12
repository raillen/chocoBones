---
name: lang-javascript
description: Modern JavaScript (ES2024+), ESM modules, immutability patterns, ESLint security rules, and zero global state pollution.
---

# Modern JavaScript & Security Contract

## 1. Modern Standards & Modules
- Use ECMAScript Modules (`import`/`export`) natively; prohibit `eval()` and `new Function()`.
- Avoid prototype pollution: never mutate `Object.prototype`.

## 2. Immutability
- Prefer `const` over `let`; prohibit `var`. Use `Object.freeze()` or spread syntax for safe state updates.
