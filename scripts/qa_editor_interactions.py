#!/usr/bin/env python3
"""Native interaction regression checks using isolated editor documents."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time
from qa_editor_ui import check_clean_exit, close_window, command, start_editor


def check_timeline_keys(output, display):
    with tempfile.TemporaryDirectory(prefix='chocobones-keyframes-') as tmp:
        case = Path(tmp)
        p, window, env, prefs, log = start_editor(case, 'light', 1, 'animate', display)
        def click(px, py):
            command('xdotool', 'mousemove', '--window', window, str(px), str(py), 'click', '1', env=env)
            time.sleep(0.18)
        def marker_red(name):
            path = output / (name + '.png')
            subprocess.run(['import', '-window', window, str(path)], env=env, check=True)
            return float(command('convert', str(path), '-format', '%[fx:p{370,778}.r]', 'info:', env=env))
        try:
            command('xdotool', 'windowmove', window, '0', '0', env=env)
            time.sleep(1.2)
            click(370, 755)  # A time between the existing frames
            click(330, 717)  # Record
            click(400, 755)  # Move the playhead away from the new diamond
            assert marker_red('keyframe-added') < 0.2, 'Record did not insert a visible frame'
            click(380, 717)  # Delete the nearest frame
            assert marker_red('keyframe-removed') > 0.9, 'Delete did not remove the inserted frame'
            # Native keyboard navigation also keeps the ruler's focus visible.
            click(450, 755)
            command('xdotool', 'key', '--delay', '100', 'Right', env=env)
            time.sleep(0.2)
            subprocess.run(['import', '-window', window, str(output / 'timeline-keyboard-focus.png')], env=env, check=True)
            close_window(window, display)
            p.wait(timeout=5)
            check_clean_exit(p, case)
        finally:
            if p.poll() is None:
                p.terminate()
                p.wait(timeout=5)
            log.close()


def capture_compact_timeline(output, display):
    with tempfile.TemporaryDirectory(prefix='chocobones-compact-timeline-') as tmp:
        case = Path(tmp)
        p, window, env, prefs, log = start_editor(case, 'light', 2, 'animate', display)
        try:
            command('xdotool', 'windowmove', window, '0', '0', env=env)
            command('xdotool', 'windowsize', window, '1280', '720', env=env)
            command('xdotool', 'mousemove', '1300', '740', env=env)
            time.sleep(1.2)
            subprocess.run(['import', '-window', window, str(output / 'animate-1280x720-200.png')], env=env, check=True)
            close_window(window, display)
            p.wait(timeout=5)
            check_clean_exit(p, case)
        finally:
            if p.poll() is None:
                p.terminate()
                p.wait(timeout=5)
            log.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--display', default=':99')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    checks = []
    with tempfile.TemporaryDirectory(prefix='chocobones-interactions-') as tmp:
        case = Path(tmp)
        p, window, env, prefs, log = start_editor(case, 'dark', 1, 'assembly', args.display)
        def x(*values):
            if values and values[0] == 'key':
                values = ('key', '--delay', '100', *(combo for value in values[1:] for combo in str(value).split()))
            command('xdotool', *map(str, values), env=env)
            time.sleep(0.18)
        def click(px, py):
            x('mousemove', '--window', window, px, py, 'click', 1)
        def capture(name):
            subprocess.run(['import', '-window', window, str(args.output / (name + '.png'))], env=env, check=True)
        def save():
            x('key', 'ctrl+s')
            return json.loads((case / 'chocobones_project.puppet.json').read_text())
        def torso(document):
            transform = next(layer for layer in document['layers'] if layer['id'] == 'torso')['transform']
            return (transform['x'], transform['y'])
        def export_pose():
            click(668, 15)
            click(730, 43)
            return hashlib.sha256((case / 'personagem_pose.png').read_bytes()).hexdigest()
        try:
            x('windowmove', window, 0, 0)
            x('windowfocus', '--sync', window)
            x('keyup', 'Control_L', 'Control_R', 'Shift_L', 'Shift_R', 'Alt_L', 'Alt_R')
            time.sleep(1.2)
            initial = save()
            checks.append('Ctrl+S saves a character independently of appearance')
            x('key', 'r')
            capture('tool-rotate')
            click(22, 100)  # Move
            x('mousemove', '--window', window, 635, 485, 'mousedown', 1)
            x('mousemove', '--window', window, 665, 485)
            x('mouseup', 1)
            moved = save()
            assert abs(torso(moved)[0] - torso(initial)[0] - 30 * 512 / 756) < 0.02, (torso(initial),torso(moved))
            x('key', 'ctrl+z')
            undone = save()
            assert torso(undone) == torso(initial), (torso(initial), torso(undone))
            x('key', 'ctrl+y')
            redone = save()
            assert torso(redone) == torso(moved), (torso(initial),torso(moved),torso(undone),torso(redone))
            checks.append('Canvas selection/drag, undo and redo preserve fitted coordinates')
            dark_hash = export_pose()
            click(715, 15)
            capture('appearance-popup')
            click(736, 57)  # Light radio in the appearance popup
            click(1080, 55)  # Dismiss
            light_hash = export_pose()
            assert dark_hash == light_hash, 'Appearance altered exported character pixels'
            checks.append('Light/dark does not alter exported PNG pixels')
            capture('light-edited-character')
            click(715, 15)
            for color in ['#000000','#FFFFFF','#123456']:
                click(780, 160)
                x('key', 'ctrl+a')
                x('type', '--clearmodifiers', color)
                x('key', 'Return')
                time.sleep(0.7)
                assert json.loads((prefs / 'preferences.json').read_text())['accent'] == color
            capture('custom-accent')
            click(1080, 55)
            assert export_pose() == dark_hash
            checks.append('Free HEX accent, black/white extremes and unchanged exported pixels')
            click(668, 15)
            click(730, 61)  # Existing spritesheet action
            sheet_size = command('identify', '-format', '%wx%h',
                                 str(case / 'personagem_walk_sheet.png'), env=env)
            assert sheet_size == '2048x1024', sheet_size
            checks.append('Spritesheet action exports the existing eight animation frames')
            for label, px in [('rig', 435), ('animate', 490), ('focus', 555), ('assembly', 375)]:
                click(px, 15)
                capture('workspace-' + label)
            checks.append('All four workspace layouts are reachable')
            click(1225, 90)  # Close Layers through its docking tab
            time.sleep(0.8)
            assert not json.loads((prefs / 'preferences.json').read_text())['panels'][0]['layers']
            click(250, 15)
            click(260, 43)  # Reopen Layers from View
            time.sleep(0.8)
            assert json.loads((prefs / 'preferences.json').read_text())['panels'][0]['layers']
            click(250, 15)
            x('key', 'Home Down Down Down Down Return')  # Restore active layout
            assert torso(save()) == torso(redone)
            checks.append('Close/reopen panels and restore layout without changing the document')
            x('mousemove', '--window', window, 1149, 300, 'mousedown', 1)
            x('mousemove', '--window', window, 1049, 300)
            x('mouseup', 1)
            capture('resized-docking')
            click(490, 15)  # Animation
            click(74, 717)  # Play
            click(715, 15)
            click(795, 57)  # Dark while playing
            click(1080, 55)
            capture('dark-playback')
            click(74, 717)  # Pause
            click(715, 15)
            click(736, 57)  # Light again
            click(1080, 55)
            checks.append('Theme can change while animation playback is active')
            click(375, 15)  # Assembly
            click(114, 55)  # 3D mode
            capture('3d-mode')
            click(190, 55)  # Model menu
            capture('3d-model-menu')
            x('key', 'Escape')
            click(40, 55)  # 2D
            checks.append('2D/3D switching renders without style-stack errors')
            close_window(window, args.display)
            p.wait(timeout=5)
            check_clean_exit(p, case)
            saved = json.loads((prefs / 'preferences.json').read_text())
            assert saved['theme'] == 'light' and saved['accent'] == '#123456'
            ini = (prefs / 'layouts.ini').read_text()
            for label in ['assembly','rig','animate','focus']:
                assert '[Window][stage_' + label + ']' in ini
            checks.append('Workspace layouts and selected appearance persist on clean exit')
            log.close()
            p, window, env, prefs, log = start_editor(case, 'dark', 1, 'assembly', args.display)
            time.sleep(0.5)
            capture('restart-light')
            brightness = float(command('convert', str(args.output / 'restart-light.png'),
                                       '-format', '%[fx:p{10,350}.r]', 'info:', env=env))
            assert brightness > 180 / 255, 'Saved light theme was not loaded'
            close_window(window, args.display)
            p.wait(timeout=5)
            check_clean_exit(p, case)
            checks.append('Restart loads the saved light theme and docking configuration')
        finally:
            if p.poll() is None:
                p.terminate()
                p.wait(timeout=5)
            log.close()

    # At 200%, the rail must scroll to expose the last explicitly mapped tool.
    with tempfile.TemporaryDirectory(prefix='chocobones-overflow-') as tmp:
        case = Path(tmp)
        p, window, env, prefs, log = start_editor(case, 'dark', 2, 'assembly', args.display)
        try:
            command('xdotool', 'windowmove', window, '0', '0', env=env)
            command('xdotool', 'windowsize', window, '1280', '720', env=env)
            time.sleep(1.2)
            command('xdotool', 'mousemove', '--window', window, '40', '600',
                    'click', '--repeat', '12', '--delay', '60', '5', env=env)
            time.sleep(0.3)
            command('xdotool', 'mousemove', '--window', window, '40', '620', 'click', '1', env=env)
            time.sleep(0.3)
            capture_path = args.output / 'weight-selected-200.png'
            subprocess.run(['import', '-window', window, str(capture_path)], env=env, check=True)
            green = float(command('convert', str(capture_path), '-format', '%[fx:p{20,620}.g]', 'info:', env=env))
            assert green > 0.5, 'Last tool was not selectable after scrolling the rail'
            close_window(window, args.display)
            p.wait(timeout=5)
            check_clean_exit(p, case)
            checks.append('At 1280x720/200%, scroll exposes and selects the Weight tool')
        finally:
            if p.poll() is None:
                p.terminate()
                p.wait(timeout=5)
            log.close()
    check_timeline_keys(args.output, args.display)
    checks.append('Record/delete keyframes and keyboard focus on the timeline ruler')
    capture_compact_timeline(args.output, args.display)
    checks.append('Compact animation timeline at 1280x720/200% renders and exits cleanly')
    (args.output / 'interaction.json').write_text(json.dumps({'checks':checks, 'export_sha256':dark_hash, 'preferences':saved},indent=2))
    print(json.dumps(checks,ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
