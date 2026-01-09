#!/usr/bin/env python3
"""
Hikari Dev Server Launcher for AI Agent

This script starts the dev server in background and exits when
the server is ready (listening on localhost:3000).

This allows the AI agent to start the server and then immediately
proceed with testing using curl, without waiting for the server
to finish.

Usage: just dev-by-agent
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# ANSI Color codes
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def write_info(message: str):
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.RESET}")


def write_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")


def write_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")


def write_warning(message: str):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")


def main():
    # Get workspace root
    workspace_root = Path(__file__).parent.parent.parent.resolve()
    os.chdir(workspace_root)

    write_info("Starting dev server in background...")
    print()

    # Start just dev in background
    # Using creationflags to detach from parent process
    if os.name == 'nt':  # Windows
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
        dev_process = subprocess.Popen(
            ["just", "dev"],
            creationflags=creationflags,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
    else:  # Unix-like
        dev_process = subprocess.Popen(
            ["just", "dev"],
            start_new_session=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )

    write_info("Waiting for server to be ready...")
    print()

    # Monitor output for the actual "listening" message from the server
    # NOT just "Server will be available" which is printed before compilation
    server_ready_indicators = [
        "Server listening on",
    ]

    timeout = 120  # 120 seconds timeout (server binary compilation can take time)
    start_time = time.time()

    try:
        while time.time() - start_time < timeout:
            line = dev_process.stdout.readline()
            if not line:
                # Process ended
                if dev_process.poll() is not None:
                    write_error("Dev server process exited unexpectedly")
                    return dev_process.returncode
                break

            # Print the line so user can see progress
            print(line, end='')

            # Check if server is ready
            line_lower = line.lower()
            if any(indicator in line_lower for indicator in server_ready_indicators):
                print()
                write_success("Server is ready! Exiting now (server continues running).")
                print()
                write_info("You can now test with:")
                print(f"  {Colors.BLUE}curl http://localhost:3000{Colors.RESET}")
                print()
                break

        # Check if we timed out
        if time.time() - start_time >= timeout:
            print()
            write_warning("Server startup timed out after 120 seconds")
            write_info("The server is still running in the background")
            write_info("You can check its status manually")

    except KeyboardInterrupt:
        print()
        write_info("Interrupted by user")
        write_info("Dev server is still running in the background")
        write_info("Use 'just run' to attach to it, or kill it manually")

    return 0


if __name__ == "__main__":
    sys.exit(main())
