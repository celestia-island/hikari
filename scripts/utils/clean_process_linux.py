#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clean processes listening on port 3000

This script finds and terminates processes that are listening on port 3000,
which is typically used by development servers.

Usage:
    python scripts/utils/clean_process.py          # Check and warn
    python scripts/utils/clean_process.py --force  # Check and kill
"""

import sys
import subprocess
import signal
import os
from typing import Optional


def print_info(message: str):
    """Print info message"""
    print(f"[INFO] {message}")


def print_success(message: str):
    """Print success message"""
    print(f"[OK] {message}")


def print_warning(message: str):
    """Print warning message"""
    print(f"[WARN] {message}")


def find_process_on_port(port: int) -> Optional[int]:
    """Find process ID listening on specified port"""
    try:
        # Use ss to find process on port (Linux alternative to netstat)
        result = subprocess.run(
            ["ss", "-tlnp"],
            capture_output=True,
            text=True,
            check=True
        )

        # Parse output to find process
        # Expected format: "LISTEN 0 4096 127.0.0.1:3000 0.0.0.0:* users:(("website_server",pid=642712,fd=9))"
        for line in result.stdout.splitlines():
            # Match port in various formats: ":3000", "127.0.0.1:3000"
            if f":{port}" in line or f"{port} " in line:
                # Look for pid=N pattern anywhere in the line
                # Match patterns like: pid=12345 or pid=12345,fd=9 or pid=12345))
                import re
                match = re.search(r'pid=(\d+)', line)
                if match:
                    try:
                        pid = int(match.group(1))
                        return pid
                    except ValueError:
                        continue

        return None

    except subprocess.CalledProcessError:
        return None
    except FileNotFoundError:
        print_warning("ss command not found, trying lsof...")
        # Fallback to lsof
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True,
                check=True
            )
            pid_str = result.stdout.strip()
            if pid_str:
                return int(pid_str)
        except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
            pass
        return None


def get_process_name(pid: int) -> str:
    """Get process name by PID"""
    try:
        # Read from /proc/<pid>/comm
        try:
            with open(f"/proc/{pid}/comm", "r") as f:
                return f.read().strip()
        except FileNotFoundError:
            # Fallback to ps command
            result = subprocess.run(
                ["ps", "-p", str(pid), "-o", "comm="],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()

    except (subprocess.CalledProcessError, FileNotFoundError):
        return "Unknown"


def kill_process(pid: int) -> bool:
    """Kill process by PID"""
    try:
        # Try graceful termination first
        os.kill(pid, signal.SIGTERM)

        # Wait a bit
        import time
        time.sleep(0.5)

        # Check if still running
        try:
            os.kill(pid, 0)  # Check if process exists
            # If still here, force kill
            os.kill(pid, signal.SIGKILL)
        except OSError:
            # Process is already dead
            pass

        return True

    except (OSError, ProcessLookupError):
        return False


def clean_port(port: int = 3000, force: bool = False):
    """Clean processes listening on the specified port"""
    print_info(f"Checking for processes on port {port}...")

    pid = find_process_on_port(port)

    if pid is None:
        print_success(f"No process found on port {port}")
        return 0

    process_name = get_process_name(pid)
    print_warning(f"Found {process_name} (PID: {pid}) listening on port {port}")

    if force:
        # With --force, kill the process
        if kill_process(pid):
            print_success(f"Successfully terminated process {pid}")
            return 0
        else:
            print_warning(f"Failed to terminate process {pid}")
            return 1
    else:
        # Without --force, just warn and exit
        print_warning(f"Process is running. Use 'just dev --force' to kill it.")
        return 0


def main():
    """Main entry point"""
    # Parse command line arguments
    force = False
    if "--force" in sys.argv or "--clean" in sys.argv:
        force = True

    return clean_port(3000, force=force)


if __name__ == "__main__":
    sys.exit(main())
