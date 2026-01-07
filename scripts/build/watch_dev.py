#!/usr/bin/env python3
"""
Hikari Development Watch Mode

This script runs two parallel processes:
1. File watcher that rebuilds WASM on changes
2. Development server (with auto-reload)

Usage: just watch-dev
"""

import os
import sys
import subprocess
import shutil
import time
import signal
from pathlib import Path
from typing import Optional

# ANSI Color codes


class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    DARK_GRAY = '\033[90m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def write_info(message: str):
    """Print info message in cyan"""
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.RESET}")


def write_success(message: str):
    """Print success message in green"""
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")


def write_warning(message: str):
    """Print warning message in yellow"""
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")


def write_error(message: str):
    """Print error message in red"""
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")


def write_step(message: str):
    """Print step header with decorative lines"""
    print()
    print(f"{Colors.DARK_GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.RESET}")
    print(f"{Colors.MAGENTA}🔧 {message}{Colors.RESET}")
    print(f"{Colors.DARK_GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.RESET}")


def check_command_exists(command: str) -> bool:
    """Check if a command exists in PATH"""
    return shutil.which(command) is not None


def run_command(cmd: list[str], error_message: str, check: bool = True) -> int:
    """Run a command and return exit code"""
    try:
        result = subprocess.run(cmd, check=check)
        return result.returncode
    except subprocess.CalledProcessError as e:
        if check:
            write_error(error_message)
            sys.exit(1)
        return e.returncode
    except FileNotFoundError:
        write_error(f"Command not found: {cmd[0]}")
        sys.exit(1)


def main():
    """Main function"""
    # Get workspace root (scripts/build -> scripts -> workspace)
    workspace_root = Path(__file__).parent.parent.parent.resolve()
    os.chdir(workspace_root)

    # Check prerequisites
    write_step("Checking prerequisites...")

    if not check_command_exists("cargo-watch"):
        write_warning("cargo-watch is not installed")
        write_info("Installing cargo-watch...")
        run_command(["cargo", "install", "cargo-watch"],
                    "Failed to install cargo-watch")
        write_success("cargo-watch installed successfully")

    # Clean up port 3000
    write_step("Cleaning up port 3000...")
    clean_process_script = workspace_root / "scripts" / "clean_process.py"
    if clean_process_script.exists():
        subprocess.run([sys.executable, str(clean_process_script)])

    # Initial build
    write_step("Performing initial build...")

    # Build hikari-builder
    exit_code = run_command(
        ["cargo", "build", "--package", "hikari-builder"],
        "hikari-builder build failed"
    )

    # Build WASM
    exit_code = run_command(
        ["cargo", "build", "--lib", "--target", "wasm32-unknown-unknown",
         "--manifest-path", "examples/demo-app/Cargo.toml"],
        "WASM build failed"
    )

    # Run wasm-bindgen
    wasm_path = "examples/demo-app/target/wasm32-unknown-unknown/debug/demo_app.wasm"
    exit_code = run_command(
        ["wasm-bindgen", "--target", "web", "--out-dir", "public/assets",
         "--no-typescript", wasm_path],
        "wasm-bindgen failed"
    )

    write_success("Initial build complete")

    # Start watch mode
    write_step("Starting watch mode...")
    write_info("Press Ctrl+C to stop all processes")
    print()

    # Start cargo-watch in background
    cargo_watch_cmd = [
        "cargo", "watch",
        "--clear",
        "--watch", "packages",
        "--watch", "examples/demo-app/src",
        "--watch", "examples/demo-app/index.html",
        "--ignore", "*/target/*",
        "--ignore", "*/generated/*",
        "--ignore", "public/assets/*",
        "--ignore", "public/styles/*",
        "--delay", "1",
        "--shell",
        "cargo build -p hikari-builder && "
        "cargo build --lib --target wasm32-unknown-unknown --manifest-path examples/demo-app/Cargo.toml && "
        "wasm-bindgen --target web --out-dir public/assets --no-typescript examples/demo-app/target/wasm32-unknown-unknown/debug/demo_app.wasm"
    ]

    watch_process: Optional[subprocess.Popen] = None
    server_process: Optional[subprocess.Popen] = None

    def cleanup(signum=None, frame=None):
        """Cleanup processes on exit"""
        print()
        write_step("Stopping watch mode...")

        if watch_process:
            try:
                watch_process.terminate()
                watch_process.wait(timeout=5)
            except:
                watch_process.kill()

        if server_process:
            try:
                server_process.terminate()
                server_process.wait(timeout=5)
            except:
                server_process.kill()

        write_success("Watch mode stopped")
        sys.exit(0)

    # Register signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        # Start cargo-watch in background
        watch_process = subprocess.Popen(
            cargo_watch_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )

        # Give watcher time to start
        time.sleep(2)

        # Start the development server
        write_info("Starting development server on http://localhost:3000")
        print()

        server_cmd = [
            "cargo", "run",
            "--manifest-path", "examples/demo-app/Cargo.toml",
            "--features", "server"
        ]

        server_process = subprocess.Popen(server_cmd)

        # Wait for server to finish (blocks until Ctrl+C)
        server_process.wait()

    except KeyboardInterrupt:
        cleanup()
    except Exception as e:
        write_error(f"Unexpected error: {e}")
        cleanup()
    finally:
        cleanup()


if __name__ == "__main__":
    main()
