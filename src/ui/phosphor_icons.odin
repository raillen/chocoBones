package ui

// =========================================================================
// Phosphor Icons — Ícones selecionados para o ChocoBones
// =========================================================================

import "core:math"
import im "../../libs/odin-imgui"

// Faixa de codepoints dos icones Phosphor para ImGui
PHOSPHOR_ICON_MIN : im.Wchar : 0xe000
PHOSPHOR_ICON_MAX : im.Wchar : 0xee82

// Faixa de glifos persistente terminada em zero para o ImFontAtlas
PHOSPHOR_GLYPH_RANGES : [3]im.Wchar = { PHOSPHOR_ICON_MIN, PHOSPHOR_ICON_MAX, 0 }

// Inicializador de FontConfig com os padrões oficiais do Dear ImGui
font_config_default :: proc() -> im.FontConfig {
	cfg: im.FontConfig
	cfg.FontDataOwnedByAtlas = true
	cfg.OversampleH = 2
	cfg.OversampleV = 1
	cfg.ExtraSizeScale = 1.0
	cfg.GlyphMaxAdvanceX = math.F32_MAX
	cfg.RasterizerMultiply = 1.0
	cfg.RasterizerDensity = 1.0
	cfg.EllipsisChar = 0
	return cfg
}

// Procedimento utilitario para carregar e mesclar Phosphor TTF no FontAtlas do ImGui
load_phosphor_font :: proc(
	font_atlas: ^im.FontAtlas,
	font_path: cstring = "assets/fonts/Phosphor.ttf",
	size_pixels: f32 = 0.0,
	merge_with_current: bool = true,
) -> (^im.Font, bool) {
	if font_atlas == nil do return nil, false

	cfg := font_config_default()
	cfg.SizePixels = size_pixels
	if merge_with_current {
		cfg.MergeMode = true
		cfg.PixelSnapH = true
	}
	font := im.FontAtlas_AddFontFromFileTTF(font_atlas, font_path, size_pixels, &cfg, &PHOSPHOR_GLYPH_RANGES[0])
	return font, font != nil
}

// -------------------------------------------------------------------------
// 1. Ferramentas do Canvas & Manipulação (Gizmo)
// -------------------------------------------------------------------------
ICON_PH_CURSOR                     :: "\ue1dc" // cursor (Mover / Seleção direta)
ICON_PH_ARROWS_OUT_CARDINAL        :: "\ue0a4" // arrows-out-cardinal (Mover 4 eixos)
ICON_PH_ARROW_CLOCKWISE            :: "\ue036" // arrow-clockwise (Girar / Rotação)
ICON_PH_ARROWS_OUT_SIMPLE          :: "\ue0a6" // arrows-out-simple (Escalar)
ICON_PH_CROSSHAIR                  :: "\ue1d6" // crosshair (Pivô central)
ICON_PH_BONE                       :: "\ue7f2" // bone (Juntas / Ossos do esqueleto)
ICON_PH_PERSON                     :: "\ue3a8" // person (Pose geral / Personagem)
ICON_PH_PERSON_ARMS_SPREAD         :: "\uecfe" // person-arms-spread (Pose T-Pose / IK)
ICON_PH_PUSH_PIN                   :: "\ue3e2" // push-pin (Pinos de deformação de malha)
ICON_PH_PAINT_BRUSH                :: "\ue6f0" // paint-brush (Pincel de pesos)
ICON_PH_PAINT_BRUSH_BROAD          :: "\ue590" // paint-brush-broad (Pintura livre de textura)
ICON_PH_ERASER                     :: "\ue21e" // eraser (Borracha / Limpar pesos)
ICON_PH_SELECTION                  :: "\ue69a" // selection (Laço de seleção de vértices)
ICON_PH_SCISSORS                   :: "\ueae0" // scissors (Cortar / Subdividir malha)
ICON_PH_HAND                       :: "\ue298" // hand (Pan / Navegar no canvas)

// -------------------------------------------------------------------------
// 2. Timeline & Controles de Animação
// -------------------------------------------------------------------------
ICON_PH_PLAY                       :: "\ue3d0" // play (Reproduzir timeline)
ICON_PH_PAUSE                      :: "\ue39e" // pause (Pausar timeline)
ICON_PH_SKIP_BACK                  :: "\ue5a4" // skip-back (Primeiro quadro / Início)
ICON_PH_SKIP_FORWARD               :: "\ue5a6" // skip-forward (Último quadro / Fim)
ICON_PH_DIAMOND                    :: "\ue1ec" // diamond (Gravar / Exibir Keyframe)
ICON_PH_REPEAT                     :: "\ue3f6" // repeat (Loop de animação)
ICON_PH_TIMER                      :: "\ue492" // timer (Duração da timeline)
ICON_PH_CLOCK                      :: "\ue19a" // clock (Tempo / FPS atual)

// -------------------------------------------------------------------------
// 3. Áreas de Trabalho (Workspaces)
// -------------------------------------------------------------------------
ICON_PH_PUZZLE_PIECE               :: "\ue596" // puzzle-piece (Montagem / Assembly)
ICON_PH_PERSON_SIMPLE_WALK         :: "\ue73a" // person-simple-walk (Animação / Ciclo)
ICON_PH_CORNERS_OUT                :: "\ue1d0" // corners-out (Foco no Palco / Tela cheia)

// -------------------------------------------------------------------------
// 4. Camadas, Hierarquia & Visibilidade
// -------------------------------------------------------------------------
ICON_PH_STACK                      :: "\ue466" // stack (Pilha de camadas)
ICON_PH_EYE                        :: "\ue220" // eye (Camada visível)
ICON_PH_EYE_SLASH                  :: "\ue224" // eye-slash (Camada oculta)
ICON_PH_LOCK                       :: "\ue2fa" // lock (Camada bloqueada)
ICON_PH_LOCK_OPEN                  :: "\ue306" // lock-open (Camada desbloqueada)
ICON_PH_LINK                       :: "\ue2e2" // link (Vínculo / Parenteamento)
ICON_PH_LINK_BREAK                 :: "\ue2e4" // link-break (Desvincular junta)
ICON_PH_TREE_STRUCTURE             :: "\ue67c" // tree-structure (Árvore de nós do rig)

// -------------------------------------------------------------------------
// 5. Gestão de Projeto & Exportação
// -------------------------------------------------------------------------
ICON_PH_FILE_PLUS                  :: "\ue236" // file-plus (Novo projeto)
ICON_PH_FOLDER                     :: "\ue24a" // folder (Pasta / Diretório)
ICON_PH_FOLDER_OPEN                :: "\ue256" // folder-open (Abrir projeto)
ICON_PH_FLOPPY_DISK                :: "\ue248" // floppy-disk (Salvar projeto)
ICON_PH_FLOPPY_DISK_BACK           :: "\ueaf4" // floppy-disk-back (Salvar como)
ICON_PH_IMAGE                      :: "\ue2ca" // image (Exportar pose PNG)
ICON_PH_IMAGES                     :: "\ue836" // images (Exportar sequência de imagens)
ICON_PH_FILM_STRIP                 :: "\ue792" // film-strip (Exportar spritesheet)
ICON_PH_CODE                       :: "\ue1bc" // code (Inspecionar JSON do projeto)

// -------------------------------------------------------------------------
// 6. Edição Geral, Histórico & Ações
// -------------------------------------------------------------------------
ICON_PH_ARROW_U_UP_LEFT            :: "\ue08a" // arrow-u-up-left (Desfazer / Undo)
ICON_PH_ARROW_U_UP_RIGHT           :: "\ue08c" // arrow-u-up-right (Refazer / Redo)
ICON_PH_BOUNDING_BOX               :: "\ue6ce" // bounding-box (Selecionar tudo)
ICON_PH_X                          :: "\ue4f6" // x (Limpar seleção / Fechar)
ICON_PH_COPY                       :: "\ue1ca" // copy (Copiar seleção)
ICON_PH_CLIPBOARD                  :: "\ue196" // clipboard (Colar)
ICON_PH_TRASH                      :: "\ue4a6" // trash (Excluir elemento)
ICON_PH_PLUS                       :: "\ue3d4" // plus (Adicionar novo item)
ICON_PH_MINUS                      :: "\ue32a" // minus (Remover item)
ICON_PH_CHECK                      :: "\ue182" // check (Confirmar / Aplicar)
ICON_PH_ARROWS_COUNTER_CLOCKWISE   :: "\ue096" // arrows-counter-clockwise (Resetar pose de repouso)

// -------------------------------------------------------------------------
// 7. Viewport, Navegação & Snapping
// -------------------------------------------------------------------------
ICON_PH_MAGNIFYING_GLASS_PLUS      :: "\ue310" // magnifying-glass-plus (Zoom in)
ICON_PH_MAGNIFYING_GLASS_MINUS     :: "\ue30e" // magnifying-glass-minus (Zoom out)
ICON_PH_ARROWS_IN                  :: "\ue09a" // arrows-in (Centralizar / Enquadrar vista)
ICON_PH_GRID_FOUR                  :: "\ue296" // grid-four (Grade de alinhamento)
ICON_PH_MAGNET                     :: "\ue680" // magnet (Snap magnético de vértices)

// -------------------------------------------------------------------------
// 8. Navegação de UI (Carets & Setas)
// -------------------------------------------------------------------------
ICON_PH_CARET_DOWN                 :: "\ue144" // caret-down (Menu suspenso / Expandir)
ICON_PH_CARET_UP                   :: "\ue14a" // caret-up (Recolher painel)
ICON_PH_CARET_LEFT                 :: "\ue146" // caret-left (Anterior)
ICON_PH_CARET_RIGHT                :: "\ue148" // caret-right (Próximo)
ICON_PH_ARROW_DOWN                 :: "\ue040" // arrow-down (Mover para baixo)
ICON_PH_ARROW_UP                   :: "\ue094" // arrow-up (Mover para cima)
ICON_PH_ARROW_LEFT                 :: "\ue04a" // arrow-left (Mover para esquerda)
ICON_PH_ARROW_RIGHT                :: "\ue050" // arrow-right (Mover para direita)
ICON_PH_DOTS_THREE                 :: "\ue204" // dots-three (Mais opções horizontal)
ICON_PH_DOTS_THREE_VERTICAL        :: "\ue206" // dots-three-vertical (Mais opções vertical)

// -------------------------------------------------------------------------
// 9. Feedback, Notificações (Toasts) & Sistema
// -------------------------------------------------------------------------
ICON_PH_CHECK_CIRCLE               :: "\ue184" // check-circle (Toast de sucesso)
ICON_PH_WARNING_CIRCLE             :: "\ue4e2" // warning-circle (Toast de alerta)
ICON_PH_X_CIRCLE                   :: "\ue4f8" // x-circle (Toast de erro)
ICON_PH_INFO                       :: "\ue2ce" // info (Toast informativo)
ICON_PH_GEAR                       :: "\ue270" // gear (Configurações do sistema)
ICON_PH_SLIDERS_HORIZONTAL         :: "\ue434" // sliders-horizontal (Parâmetros / Ajustes)
ICON_PH_QUESTION                   :: "\ue3e8" // question (Ajuda / Documentação)
ICON_PH_PULSE                      :: "\ue3e0" // pulse (Atividade / Status do app)
ICON_PH_CUBE                       :: "\ue1d4" // cube (Modelos e Geometrias 3D)
ICON_PH_CYLINDER                   :: "\ue81c" // cylinder (Primitiva 3D cilíndrica)
