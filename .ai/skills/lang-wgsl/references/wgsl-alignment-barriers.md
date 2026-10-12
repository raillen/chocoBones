# WGSL Alignment Reference
1. **Alignment**: vec3<f32> requires 16-byte alignment and 12-byte size.
2. **Compute Barrier**: Call `workgroupBarrier()` to establish execution and memory consistency.\n