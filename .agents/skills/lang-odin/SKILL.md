<!-- prumo:managed -->
---
name: lang-odin
description: Odin programming language, explicit context management, custom allocators, tracking allocators for leak detection, distinct types, and SoA/AoS data layouts.
---

# Odin Context Management & Memory Control Contract

## 1. Context & Allocator Discipline
- **Explicit `context` Allocation**: Leverage the implicit/explicit `context.allocator`. For unit tests and verification, swap `context.allocator` with a `mem.Tracking_Allocator` to assert zero memory leaks upon scope termination.
- **`defer delete(dynamic_array)`**: Dynamic arrays and maps allocated in local scopes must be freed explicitly using `defer delete(...)`.
- **Distinct Types**: Create strong domain types using `distinct` to prevent accidental type confusion (e.g., `distinct u64` for entity IDs).

## 2. Data-Oriented Architecture
- Organize performance-critical data structures using `#soa` (Structure of Arrays) for optimal CPU cache line utilization.
- Zero hidden control flow: no operator overloading, no implicit conversions.
