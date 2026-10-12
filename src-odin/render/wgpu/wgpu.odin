package wgpu

import "core:fmt"

foreign import libwgpu "../../../libs/wgpu/lib/libwgpu_native.so"

Instance            :: distinct rawptr
Adapter             :: distinct rawptr
Device              :: distinct rawptr
Queue               :: distinct rawptr
Surface             :: distinct rawptr
ShaderModule        :: distinct rawptr
RenderPipeline      :: distinct rawptr
Buffer              :: distinct rawptr
Texture             :: distinct rawptr
TextureView         :: distinct rawptr
CommandEncoder      :: distinct rawptr
RenderPassEncoder   :: distinct rawptr
CommandBuffer       :: distinct rawptr

@(default_calling_convention="c")
foreign libwgpu {
	wgpuGetVersion :: proc() -> u32 ---
	wgpuCreateInstance :: proc(descriptor: rawptr) -> Instance ---
	wgpuInstanceRelease :: proc(instance: Instance) ---
}

WGPUContext :: struct {
	instance:    Instance,
	version_u32: u32,
	initialized: bool,
}

wgpu_context_init :: proc() -> (WGPUContext, bool) {
	ver := wgpuGetVersion()
	inst := wgpuCreateInstance(nil)
	if inst == nil {
		fmt.eprintln("[WGPU] Falha ao criar WGPUInstance via libwgpu_native.so")
		return {}, false
	}

	major := (ver >> 24) & 0xFF
	minor := (ver >> 16) & 0xFF
	patch := (ver >> 8) & 0xFF
	sub := ver & 0xFF

	fmt.printf("[WGPU] wgpu-native inicializado com sucesso! Versão: %d.%d.%d.%d (raw: 0x%08X)\n", major, minor, patch, sub, ver)

	return WGPUContext{
		instance    = inst,
		version_u32 = ver,
		initialized = true,
	}, true
}

wgpu_context_destroy :: proc(ctx: ^WGPUContext) {
	if ctx != nil && ctx.instance != nil {
		wgpuInstanceRelease(ctx.instance)
		ctx.instance = nil
		ctx.initialized = false
	}
}
