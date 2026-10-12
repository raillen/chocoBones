package tests

import "core:os"
import "core:testing"
import "../src/ui"

@(test)
test_native_dialog_helper_exists :: proc(t: ^testing.T) {
	testing.expect(t, os.exists("scripts/native_dialog.py"), "scripts/native_dialog.py deve existir")
}

@(test)
test_native_dialog_enums :: proc(t: ^testing.T) {
	m_open := ui.DialogMode.Open
	m_save := ui.DialogMode.Save
	f_img := ui.DialogFilter.Image
	f_proj := ui.DialogFilter.Project
	f_mesh := ui.DialogFilter.Mesh

	testing.expect(t, m_open != m_save, "DialogMode Open e Save devem ser distintos")
	testing.expect(t, f_img != f_proj && f_img != f_mesh, "DialogFilter deve suportar categorias distintas")
}
