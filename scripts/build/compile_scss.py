#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hikari SCSS Compiler

Compiles all SCSS files into a single CSS bundle using Dart Sass CLI.
"""

import os
import sys
import io
import subprocess
from pathlib import Path

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def main():
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Hikari SCSS Compiler")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # Find workspace root
    workspace_root = Path(__file__).parent.parent.parent
    print(f"\n📂 Workspace root: {workspace_root}")

    # Input SCSS file
    index_scss = workspace_root / "packages/components/src/styles/index.scss"
    if not index_scss.exists():
        print(f"\n❌ Error: {index_scss} not found")
        sys.exit(1)

    # Output directory
    output_dir = workspace_root / "public/styles"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_css = output_dir / "bundle.css"

    # Try to find sass command
    sass_cmd = None

    # On Windows, try to find sass.exe or sass.cmd
    if sys.platform == "win32":
        # Try shell=True to use PATH
        try:
            result = subprocess.run(
                'sass --version',
                shell=True,
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
                encoding='utf-8',
                errors='replace'
            )
            if result.returncode == 0:
                sass_cmd = 'sass'
        except Exception:
            pass

    # If not found, try without shell
    if not sass_cmd:
        for cmd in ['sass', 'sass.exe', 'sass.cmd', 'dart', 'sassc']:
            try:
                result = subprocess.run(
                    [cmd, '--version'],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False
                )
                if result.returncode == 0:
                    sass_cmd = cmd
                    if cmd == 'dart':
                        sass_cmd = 'sass'  # Dart's sass CLI is just 'sass'
                    break
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue

    if not sass_cmd:
        print("\n❌ Error: Sass compiler not found!")
        print("\n   Please install Dart Sass:")
        print("   • Windows: choco install sass")
        print("   • Or download from: https://github.com/sass/dart-sass/releases")
        print("   • Or with npm: npm install -g sass")
        sys.exit(1)

    print(f"\n🔨 Using sass command: {sass_cmd}")
    print(f"   Input:  {index_scss.relative_to(workspace_root)}")
    print(f"   Output: {output_css.relative_to(workspace_root)}")

    # Compile SCSS using sass CLI
    try:
        # Build command
        cmd_list = [
            sass_cmd,
            str(index_scss),
            str(output_css),
            '--load-path=' + str(workspace_root / "packages/theme/styles"),
            '--load-path=' + str(workspace_root / "packages/components/src/styles"),
            '--no-source-map',
            '--style=expanded',
        ]

        # On Windows, use shell=True for PATH resolution
        use_shell = sys.platform == "win32"

        result = subprocess.run(
            cmd_list if not use_shell else subprocess.list2cmdline(cmd_list),
            shell=use_shell,
            capture_output=True,
            text=True,
            timeout=60,
            check=True,
            encoding='utf-8',
            errors='replace'
        )

        print(result.stdout)

        # Get file size
        file_size = output_css.stat().st_size
        print(f"\n✅ CSS bundle generated successfully!")
        print(f"   Size: {file_size:,} bytes")
        print(f"   Path: {output_css}")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ SCSS compilation failed:")
        print(f"   {e.stderr}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == '__main__':
    main()
