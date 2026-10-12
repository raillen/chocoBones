package core

import "core:mem"

ArenaContext :: struct {
	buffer:    []byte,
	arena:     mem.Arena,
	allocator: mem.Allocator,
}

arena_context_init :: proc(ctx: ^ArenaContext, size: int) -> bool {
	buffer := make([]byte, size)
	if buffer == nil do return false
	ctx.buffer = buffer
	mem.arena_init(&ctx.arena, ctx.buffer)
	ctx.allocator = mem.arena_allocator(&ctx.arena)
	return true
}

arena_context_reset :: proc(ctx: ^ArenaContext) {
	mem.arena_free_all(&ctx.arena)
}

arena_context_destroy :: proc(ctx: ^ArenaContext) {
	delete(ctx.buffer)
	ctx.buffer = nil
}
