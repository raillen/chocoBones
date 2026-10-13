#!/usr/bin/env python3
"""
ChocoBones Native System File Dialog Helper
Opens the native system file chooser dialog using:
1. Zenity (GTK) if available
2. KDialog (KDE) if available
3. Tkinter (Standard cross-platform desktop dialog)
Supports both single and multiple file selection.
"""

import os
import shutil
import subprocess
import sys

def run_zenity(mode, title, filter_spec, multiple):
    if not shutil.which("zenity"):
        return None
    cmd = ["zenity", "--file-selection", f"--title={title}"]
    if mode == "save":
        cmd.append("--save")
        cmd.append("--confirm-overwrite")
    if multiple and mode != "save":
        cmd.append("--multiple")
        cmd.append("--separator=\n")
    if filter_spec == "png":
        cmd.append("--file-filter=PNG | *.png")
    elif filter_spec == "image":
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
        lines = [line.strip() for line in res.stdout.strip().split("\n") if line.strip()]
        return lines
    return []

def run_kdialog(mode, title, filter_spec, multiple):
    if not shutil.which("kdialog"):
        return None
    pattern = "*"
    if filter_spec == "png":
        pattern = "*.png"
    elif filter_spec == "image":
        pattern = "*.png *.jpg *.jpeg *.bmp *.tga"
    elif filter_spec == "project":
        pattern = "*.json *.puppet.json"
    elif filter_spec == "mesh":
        pattern = "*.obj *.gltf *.glb"
        
    cmd = ["kdialog"]
    if mode == "save":
        cmd.extend(["--getsavefilename", ".", pattern, f"--title={title}"])
    else:
        if multiple:
            cmd.extend(["--getopenfilename", ".", pattern, "--multiple", f"--title={title}"])
        else:
            cmd.extend(["--getopenfilename", ".", pattern, f"--title={title}"])
            
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        # kdialog separates multiple files with space or newline
        lines = [line.strip() for line in res.stdout.strip().split() if line.strip()]
        return lines
    return []

def run_tkinter(mode, title, filter_spec, multiple):
    if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
        return []
        
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        # Bring to front
        root.attributes("-topmost", True)
        
        types = [("Todos os arquivos", "*.*")]
        if filter_spec == "png":
            types = [("PNG Image", "*.png")]
        elif filter_spec == "image":
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
            
        selected_files = []
        if mode == "save":
            path = filedialog.asksaveasfilename(title=title, filetypes=types)
            if path:
                selected_files = [path]
        else:
            if multiple:
                paths = filedialog.askopenfilenames(title=title, filetypes=types)
                selected_files = list(paths)
            else:
                path = filedialog.askopenfilename(title=title, filetypes=types)
                if path:
                    selected_files = [path]
            
        root.destroy()
        return selected_files
    except Exception:
        return []

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "open"
    title = sys.argv[2] if len(sys.argv) > 2 else "Selecione um Arquivo"
    filter_spec = sys.argv[3] if len(sys.argv) > 3 else "image"
    multiple = (sys.argv[4].lower() in ("multiple", "true", "1")) if len(sys.argv) > 4 else False
    
    # 1. Try Zenity
    res = run_zenity(mode, title, filter_spec, multiple)
    if res is not None:
        for p in res:
            print(p)
        return
        
    # 2. Try KDialog
    res = run_kdialog(mode, title, filter_spec, multiple)
    if res is not None:
        for p in res:
            print(p)
        return
        
    # 3. Use Tkinter
    res = run_tkinter(mode, title, filter_spec, multiple)
    for p in res:
        print(p)

if __name__ == "__main__":
    main()
