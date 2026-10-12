# WGSL Rules Checklist
- [ ] Validated with naga or wgpu CLI.
- [ ] Uniform/storage struct alignments comply with WebGPU spec.
- [ ] workgroupBarrier() invoked between shared memory write and read.
- [ ] Explicit address spaces declared.\n