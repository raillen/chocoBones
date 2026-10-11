#!/usr/bin/env python3
"""Capture native ImGui windows in an isolated X11 display/configuration."""
import argparse
import ctypes
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def command(*args, env):
    return subprocess.check_output(args, env=env, text=True, stderr=subprocess.DEVNULL).strip()


def check_clean_exit(process, case_dir):
    output = (case_dir / "runtime.log").read_text()
    unexpected = [line for line in output.splitlines()
                  if not line.startswith("[WGPU] wgpu-native inicializado com sucesso!")]
    assert process.returncode == 0 and not unexpected, output
    return output


def close_window(window, display_name):
    class Data(ctypes.Union):
        _fields_ = [("l", ctypes.c_long * 5)]
    class Message(ctypes.Structure):
        _fields_ = [("type", ctypes.c_int), ("serial", ctypes.c_ulong),
                    ("send_event", ctypes.c_int), ("display", ctypes.c_void_p),
                    ("window", ctypes.c_ulong), ("message_type", ctypes.c_ulong),
                    ("format", ctypes.c_int), ("data", Data)]
    class Event(ctypes.Union):
        _fields_ = [("message", Message), ("padding", ctypes.c_long * 24)]
    x = ctypes.CDLL("libX11.so.6")
    x.XOpenDisplay.argtypes, x.XOpenDisplay.restype = [ctypes.c_char_p], ctypes.c_void_p
    x.XInternAtom.argtypes, x.XInternAtom.restype = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int], ctypes.c_ulong
    x.XSendEvent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_long, ctypes.POINTER(Event)]
    x.XFlush.argtypes = [ctypes.c_void_p]
    x.XCloseDisplay.argtypes = [ctypes.c_void_p]
    display = x.XOpenDisplay(display_name.encode())
    if not display:
        raise RuntimeError("X11 display unavailable")
    event = Event()
    event.message.type = 33  # ClientMessage
    event.message.display = display
    event.message.window = int(window)
    event.message.message_type = x.XInternAtom(display, b"WM_PROTOCOLS", 0)
    event.message.format = 32
    event.message.data.l[0] = x.XInternAtom(display, b"WM_DELETE_WINDOW", 0)
    x.XSendEvent(display, int(window), 0, 0, ctypes.byref(event))
    x.XFlush(display)
    x.XCloseDisplay(display)


def start_editor(case_dir, theme, scale, workspace, display):
    prefs = case_dir / "config/chocoBones/chocoBones-std"
    prefs.mkdir(parents=True, exist_ok=True)
    if not (prefs / "preferences.json").exists():
        (prefs / "preferences.json").write_text(json.dumps({
            "version": 1, "theme": theme, "accent": "#00B8D9", "workspace": workspace,
        }))
    if not (case_dir / "assets").exists():
        (case_dir / "assets").symlink_to(ROOT / "assets", target_is_directory=True)
    runtime = case_dir / "runtime"
    runtime.mkdir(mode=0o700, exist_ok=True)
    env = dict(os.environ, DISPLAY=display, XDG_DATA_HOME=str(case_dir / "config"),
               XDG_RUNTIME_DIR=str(runtime), CHOCOBONES_UI_SCALE=str(scale))
    log = (case_dir / "runtime.log").open("w")
    process = subprocess.Popen([str(ROOT / "bin/chocobones")], cwd=case_dir,
                               env=env, stdout=log, stderr=subprocess.STDOUT)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError((case_dir / "runtime.log").read_text())
        try:
            window = command("xdotool", "search", "--onlyvisible", "--pid", str(process.pid), env=env).splitlines()[0]
            return process, window, env, prefs, log
        except (subprocess.CalledProcessError, IndexError):
            time.sleep(0.05)
    process.terminate()
    raise RuntimeError("Editor window did not appear")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--display", default=os.environ.get("DISPLAY", ":99"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    for theme in ("dark", "light"):
        for width, height in ((1280, 720), (1440, 900), (1920, 1080)):
            for scale in (1, 1.5, 2):
                name = f"{theme}-{width}x{height}-{int(scale * 100)}"
                with tempfile.TemporaryDirectory(prefix="chocobones-qa-") as tmp:
                    case_dir = Path(tmp)
                    process, window, env, prefs, log = start_editor(case_dir, theme, scale, "assembly", args.display)
                    try:
                        command("xdotool", "windowmove", window, "0", "0", env=env)
                        command("xdotool", "windowsize", window, str(width), str(height), env=env)
                        command("xdotool", "mousemove", str(width + 20), str(height + 20), env=env)
                        time.sleep(0.45)
                        subprocess.run(["import", "-window", window, str(args.output / f"{name}.png")], env=env, check=True)
                        close_window(window, args.display)
                        process.wait(timeout=5)
                        saved = json.loads((prefs / "preferences.json").read_text())
                        assert saved["theme"] == theme and saved["accent"] == "#00B8D9"
                        ini = (prefs / "layouts.ini").read_text()
                        assert "[Window][stage_assembly]" in ini and "DockSpace" in ini
                        log.flush()
                        output = check_clean_exit(process, case_dir)
                        results.append({"case": name, "exit": process.returncode, "preferences": "passed", "layout": "passed", "log": output})
                        print(f"PASS {name}", flush=True)
                    finally:
                        if process.poll() is None:
                            process.terminate()
                            process.wait(timeout=5)
                        log.close()
    (args.output / "matrix.json").write_text(json.dumps(results, indent=2))
    print(f"Captured {len(results)} native windows; all exited cleanly and persisted preferences/layouts.", flush=True)


if __name__ == "__main__":
    main()
