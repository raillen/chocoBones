<!-- prumo:managed -->
# Odin Context & Tracking Allocator Reference

1. **Context System**: Implicit thread-local environment struct passed to procedures. Contains `allocator`, `temp_allocator`, `logger`, `assertion_failure_proc`.
2. **Tracking Allocator**:
   ```odin
   track: mem.Tracking_Allocator
   mem.tracking_allocator_init(&track, context.allocator)
   context.allocator = mem.tracking_allocator(&track)
   defer {
       for _, leak in track.allocation_map {
           fmt.printf("%v leaked %m\n", leak.location, leak.size)
       }
       mem.tracking_allocator_destroy(&track)
   }
   ```
