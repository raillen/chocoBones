<!-- prumo:managed -->
# Odin Safety Checklist

- [ ] `mem.Tracking_Allocator` employed in all test suites to guarantee 0 leaks.
- [ ] Dynamic allocations (`make`, `new`) paired with `defer delete(...)` or `defer free(...)`.
- [ ] Strong domain primitives declared as `distinct` types.
- [ ] Raw pointer casts (`cast(rawptr)`) registered in `.prumo/escape-hatches.json`.
