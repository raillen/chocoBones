<!-- prumo:managed -->
package main

import "core:fmt"
import "core:mem"

main :: proc() {
    track: mem.Tracking_Allocator
    mem.tracking_allocator_init(&track, context.allocator)
    defer mem.tracking_allocator_destroy(&track)
    context.allocator = mem.tracking_allocator(&track)

    items := make([dynamic]int)
    defer delete(items)

    append(&items, 10, 20, 30)
    fmt.printf("Items count: %d\n", len(items))
}
