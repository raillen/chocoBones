package tests

import "core:c"
import "core:os"
import "core:strings"
import "core:testing"
import stbi "vendor:stb/image"
import "../src/export"

@(test)
test_export_rgba_png :: proc(t: ^testing.T) {
	w: i32 = 64
	h: i32 = 64
	total_bytes := int(w * h * 4)

	pixels := make([]u8, total_bytes, context.temp_allocator)
	for y in 0 ..< int(h) {
		for x in 0 ..< int(w) {
			idx := (y * int(w) + x) * 4
			pixels[idx + 0] = u8(x * 4)
			pixels[idx + 1] = u8(y * 4)
			pixels[idx + 2] = 128
			pixels[idx + 3] = 255
		}
	}

	test_png_path := "/tmp/test_exported_chocobones.png"
	defer os.remove(test_png_path)

	ok := export.export_image_rgba_to_png(test_png_path, pixels, w, h)
	testing.expect(t, ok, "Gravação do arquivo PNG deve ter sucesso")

	// Recarrega o PNG gerado para garantir fidelidade
	out_w, out_h, out_channels: c.int
	c_path := strings.clone_to_cstring(test_png_path, context.temp_allocator)
	loaded_pixels := stbi.load(c_path, &out_w, &out_h, &out_channels, 4)
	testing.expect(t, loaded_pixels != nil, "Arquivo PNG gerado deve ser decodificável pelo stb_image")
	defer stbi.image_free(loaded_pixels)

	testing.expect(t, out_w == 64, "Largura lida deve ser 64")
	testing.expect(t, out_h == 64, "Altura lida deve ser 64")

	// Verifica o pixel de teste no canto (10, 10)
	pixel_data := transmute([^]u8)loaded_pixels
	idx := (10 * 64 + 10) * 4
	testing.expect(t, pixel_data[idx + 0] == u8(10 * 4), "Canal R deve coincidir")
	testing.expect(t, pixel_data[idx + 1] == u8(10 * 4), "Canal G deve coincidir")
	testing.expect(t, pixel_data[idx + 2] == 128, "Canal B deve coincidir")
	testing.expect(t, pixel_data[idx + 3] == 255, "Canal A deve coincidir")
}

@(test)
test_export_spritesheet_grid :: proc(t: ^testing.T) {
	frame_w: i32 = 16
	frame_h: i32 = 16
	frame_bytes := int(frame_w * frame_h * 4)

	f1 := make([]u8, frame_bytes, context.temp_allocator)
	f2 := make([]u8, frame_bytes, context.temp_allocator)
	f3 := make([]u8, frame_bytes, context.temp_allocator)
	f4 := make([]u8, frame_bytes, context.temp_allocator)

	for i in 0 ..< int(frame_w * frame_h) {
		f1[i * 4 + 0] = 255 // Vermelho
		f1[i * 4 + 3] = 255
		f2[i * 4 + 1] = 255 // Verde
		f2[i * 4 + 3] = 255
		f3[i * 4 + 2] = 255 // Azul
		f3[i * 4 + 3] = 255
		f4[i * 4 + 0] = 255 // Amarelo
		f4[i * 4 + 1] = 255
		f4[i * 4 + 3] = 255
	}

	frames := [][]u8{f1, f2, f3, f4}
	sheet_path := "/tmp/test_chocobones_sheet.png"
	defer os.remove(sheet_path)

	ok := export.export_spritesheet_grid(sheet_path, frames, frame_w, frame_h, 2)
	testing.expect(t, ok, "Geração de spritesheet grid 2x2 deve ter sucesso")

	out_w, out_h, out_channels: c.int
	c_path := strings.clone_to_cstring(sheet_path, context.temp_allocator)
	loaded := stbi.load(c_path, &out_w, &out_h, &out_channels, 4)
	testing.expect(t, loaded != nil, "Spritesheet gerada deve ser lida")
	defer stbi.image_free(loaded)

	testing.expect(t, out_w == 32, "Largura total deve ser 2 colunas * 16 = 32")
	testing.expect(t, out_h == 32, "Altura total deve ser 2 linhas * 16 = 32")
}

