package render

import gl "vendor:OpenGL"

Framebuffer :: struct {
	fbo:     u32,
	texture: u32,
	rbo:     u32,
	width:   i32,
	height:  i32,
}

fbo_create :: proc(width, height: i32) -> (Framebuffer, bool) {
	fb := Framebuffer{width = width, height = height}

	gl.GenFramebuffers(1, &fb.fbo)
	gl.BindFramebuffer(gl.FRAMEBUFFER, fb.fbo)

	// Anexo de Textura de Cor
	gl.GenTextures(1, &fb.texture)
	gl.BindTexture(gl.TEXTURE_2D, fb.texture)
	gl.TexImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, nil)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.FramebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fb.texture, 0)

	// Renderbuffer para Depth e Stencil
	gl.GenRenderbuffers(1, &fb.rbo)
	gl.BindRenderbuffer(gl.RENDERBUFFER, fb.rbo)
	gl.RenderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height)
	gl.FramebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, fb.rbo)

	status := gl.CheckFramebufferStatus(gl.FRAMEBUFFER)
	gl.BindFramebuffer(gl.FRAMEBUFFER, 0)

	if status != gl.FRAMEBUFFER_COMPLETE {
		fbo_destroy(&fb)
		return {}, false
	}

	return fb, true
}

fbo_resize :: proc(fb: ^Framebuffer, width, height: i32) {
	if fb == nil || (fb.width == width && fb.height == height) do return
	if width <= 0 || height <= 0 do return

	fbo_destroy(fb)
	new_fb, ok := fbo_create(width, height)
	if ok {
		fb^ = new_fb
	}
}

fbo_bind :: proc(fb: ^Framebuffer) {
	if fb != nil && fb.fbo != 0 {
		gl.BindFramebuffer(gl.FRAMEBUFFER, fb.fbo)
		gl.Viewport(0, 0, fb.width, fb.height)
	}
}

fbo_unbind :: proc(viewport_w, viewport_h: i32) {
	gl.BindFramebuffer(gl.FRAMEBUFFER, 0)
	gl.Viewport(0, 0, viewport_w, viewport_h)
}

fbo_destroy :: proc(fb: ^Framebuffer) {
	if fb == nil do return
	if fb.texture != 0 {
		gl.DeleteTextures(1, &fb.texture)
		fb.texture = 0
	}
	if fb.rbo != 0 {
		gl.DeleteRenderbuffers(1, &fb.rbo)
		fb.rbo = 0
	}
	if fb.fbo != 0 {
		gl.DeleteFramebuffers(1, &fb.fbo)
		fb.fbo = 0
	}
}
