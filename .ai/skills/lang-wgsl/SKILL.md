---
name: lang-wgsl
description: WGSL WebGPU standards, struct layout and alignment rules, compute workgroup barriers, atomic safety, and naga validation.
---

# WGSL WebGPU Soundness Contract

## 1. WebGPU Specification & Validation
- Validate all WGSL shaders using \`naga\` or \`wgpu-native\` validation tooling in CI.
- Adhere strictly to the W3C WebGPU Shading Language standard.

## 2. Memory Layout & Struct Alignment
- Explicitly satisfy memory alignment rules: \`vec3<f32>\` aligns to 16 bytes; ensure struct members align with host-side buffer layouts.
- Use explicit address spaces: \`var<uniform>\`, \`var<storage, read_write>\`, \`var<workgroup>\`.

## 3. Compute Concurrency & Barriers
- In compute shaders using workgroup shared memory, synchronize with \`workgroupBarrier()\` before consuming shared data.
- Use \`atomic<u32>\` and WGSL atomic operations for concurrent shared memory access.\n