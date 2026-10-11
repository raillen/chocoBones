#!/usr/bin/env python3
"""
ChocoBones Native System File Dialog Helper
Opens the native system file chooser dialog using the best available desktop interface:
1. Zenity (GTK)
2. KDialog (KDE)
3. XDG Desktop Portal (GNOME / KDE / Flatpak standard)
4. Tkinter (Python standard fallback)
"""

import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

def run_zenity(mode, title, filter_spec):
    if not shutil.which("zenity"):
        return None
    cmd = ["zenity", "--file-selection", f"--title={title}"]
    if mode == "save":
        cmd.append("--save")
        cmd.append("--confirm-overwrite")
    if filter_spec == "image":
        cmd.append("--file-filter=Imagens (PNG, JPG, BMP, TGA) | *.png *.jpg *.jpeg *.bmp *.tga")
        cmd.append("--file-filter=Todos os arquivos | *")
    elif filter_spec == "project":
        cmd.append("--file-filter=Projetos ChocoBones (*.json) | *.json *.puppet.json")
        cmd.append("--file-filter=Todos os arquivos | *")
    elif filter_spec == "mesh":
        cmd.append("--file-filter=Modelos 3D (*.obj, *.gltf, *.glb) | *.obj *.gltf *.glb")
        cmd.append("--file-filter=Todos os arquivos | *")
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        return res.stdout.strip()
    return ""

def run_kdialog(mode, title, filter_spec):
    if not shutil.which("kdialog"):
        return None
    pattern = "*"
    if filter_spec == "image":
        pattern = "*.png *.jpg *.jpeg *.bmp *.tga"
    elif filter_spec == "project":
        pattern = "*.json *.puppet.json"
    elif filter_spec == "mesh":
        pattern = "*.obj *.gltf *.glb"
        
    cmd = ["kdialog", "--getsavefilename" if mode == "save" else "--getopenfilename", ".", pattern, f"--title={title}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        return res.stdout.strip()
    return ""

def run_portal(mode, title, filter_spec):
    if not shutil.which("gdbus"):
        return None
        
    method = "SaveFile" if mode == "save" else "OpenFile"
    token = f"chocobones_{int(time.time() * 1000)}"
    
    # Listen to response signals
    mon = subprocess.Popen(
        ["gdbus", "monitor", "--session", "--dest", "org.freedesktop.portal.Desktop"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True
    )
    time.sleep(0.04)
    
    call = subprocess.run([
        "gdbus", "call", "--session",
        "--dest", "org.freedesktop.portal.Desktop",
        "--object-path", "/org/freedesktop/portal/desktop",
        "--method", f"org.freedesktop.portal.FileChooser.{method}",
        "", title,
        f"{{'handle_token': <'{token}'>}}"
    ], capture_output=True, text=True)
    
    if call.returncode != 0:
        mon.kill()
        return None
        
    m = re.search(r"'(/org/freedesktop/portal/desktop/request/[^']+)'", call.stdout)
    if not m:
        mon.kill()
        return None
        
    req_path = m.group(1)
    accum = ""
    start = time.time()
    
    while time.time() - start < 180: # 3 minutes max
        line = mon.stdout.readline()
        if not line:
            break
        accum += line
        if req_path in accum or "Response" in line:
            if "uint32 1" in line: # Cancelled by user
                mon.kill()
                return ""
            if "uris" in accum and "}" in line:
                break
                
    mon.kill()
    uri_m = re.search(r"'file://([^']+)'", accum)
    if uri_m:
        return urllib.parse.unquote(uri_m.group(1))
    return ""

def run_tkinter(mode, title, filter_spec):
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        
        types = [("Todos os arquivos", "*.*")]
        if filter_spec == "image":
            types = [
                ("Imagens (PNG, JPG, BMP, TGA)", "*.png *.jpg *.jpeg *.bmp *.tga"),
                ("PNG Image", "*.png"),
                ("JPEG Image", "*.jpg *.jpeg"),
                ("Todos os arquivos", "*.*")
            ]
        elif filter_spec == "project":
            types = [
                ("Projeto ChocoBones (*.json)", "*.json *.puppet.json"),
                ("Todos os arquivos", "*.*")
            ]
        elif filter_spec == "mesh":
            types = [
                ("Modelos 3D (*.obj, *.gltf, *.glb)", "*.obj *.gltf *.glb"),
                ("Todos os arquivos", "*.*")
            ]
            
        if mode == "save":
            path = filedialog.asksaveasfilename(title=title, filetypes=types)
        else:
            path = filedialog.askopenfilename(title=title, filetypes=types)
            
        root.destroy()
        return path or ""
    except Exception:
        return ""

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "open"
    title = sys.argv[2] if len(sys.argv) > 2 else "Selecione um Arquivo"
    filter_spec = sys.argv[3] if len(sys.argv) > 3 else "image"
    
    # 1. Try Zenity
    res = run_zenity(mode, title, filter_spec)
    if res is not None:
        if res:
            print(res)
        return
        
    # 2. Try KDialog
    res = run_kdialog(mode, title, filter_spec)
    if res is not None:
        if res:
            print(res)
        return
        
    # 3. Try XDG Desktop Portal
    res = run_portal(mode, title, filter_spec)
    if res is not None:
        if res:
            print(res)
        return
        
    # 4. Fallback to Tkinter
    res = run_tkinter(mode, title, filter_spec)
    if res:
        print(res)

if __name__ == "__main__":
    main()
