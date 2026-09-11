#!/usr/bin/env bash
# PostMCP Installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/BraveRam/postmcp/main/install.sh | bash

set -euo pipefail

PACKAGE="postmcp"

# Color helpers
if [ -t 1 ]; then
    BOLD="\033[1m"
    CYAN="\033[36m"
    GREEN="\033[32m"
    YELLOW="\033[33m"
    DIM="\033[2m"
    RESET="\033[0m"
else
    BOLD=""
    CYAN=""
    GREEN=""
    YELLOW=""
    DIM=""
    RESET=""
fi

echo -e "${CYAN}--------------------------------------------------------${RESET}"
echo -e "${BOLD} PostMCP Installer${RESET}"
echo -e " The Postman for MCP: Turn OpenAPI into Safe, Context-Optimized MCP Servers"
echo -e "${CYAN}--------------------------------------------------------${RESET}"

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required but not installed." >&2
    echo "Please install Node.js (v18 or higher) from https://nodejs.org or via your package manager." >&2
    exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="$(echo "${NODE_VERSION}" | cut -d. -f1)"

if [ "${NODE_MAJOR}" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version ${NODE_VERSION} detected. PostMCP recommends Node.js 18 or higher.${RESET}" >&2
fi

# 2. Select Package Manager
INSTALL_CMD=""
if command -v npm >/dev/null 2>&1; then
    INSTALL_CMD="npm install -g ${PACKAGE}@latest"
elif command -v pnpm >/dev/null 2>&1; then
    INSTALL_CMD="pnpm add -g ${PACKAGE}@latest"
elif command -v bun >/dev/null 2>&1; then
    INSTALL_CMD="bun add -g ${PACKAGE}@latest"
elif command -v yarn >/dev/null 2>&1; then
    INSTALL_CMD="yarn global add ${PACKAGE}@latest"
else
    echo "Error: No supported package manager found (npm, pnpm, bun, yarn)." >&2
    exit 1
fi

echo -e "Installing ${BOLD}${PACKAGE}${RESET} globally via ${INSTALL_CMD%% *}..."

# 3. Attempt Installation
if ! eval "${INSTALL_CMD}" 2>/dev/null; then
    echo -e "${YELLOW}Standard global installation failed (likely permission error).${RESET}"
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        echo "Attempting installation with sudo..."
        sudo ${INSTALL_CMD}
    else
        echo "Error: Could not install globally. Please check npm permissions or run:" >&2
        echo "  sudo ${INSTALL_CMD}" >&2
        exit 1
    fi
fi

# 4. Verify Installation
if command -v postmcp >/dev/null 2>&1; then
    INSTALLED_VER="$(postmcp --version 2>/dev/null || echo 'latest')"
    echo ""
    echo -e "${GREEN}========================================================================${RESET}"
    echo -e "${BOLD}${GREEN}PostMCP ${INSTALLED_VER} installed successfully!${RESET}"
    echo -e "${GREEN}========================================================================${RESET}"
    echo ""
    echo -e "${BOLD}To launch the Visual Web Studio and documentation, run:${RESET}"
    echo ""
    echo -e "  ${CYAN}${BOLD}postmcp studio${RESET}"
    echo ""
    echo -e "  ${DIM}* Studio Workbench:    http://localhost:3000${RESET}"
    echo -e "  ${DIM}* Built-in Docs:       http://localhost:3000/docs${RESET}"
    echo -e "  ${DIM}* Open Docs directly:  postmcp docs${RESET}"
    echo ""
    echo -e "${GREEN}------------------------------------------------------------------------${RESET}"
    echo -e "${BOLD}Quickstart CLI Commands:${RESET}"
    echo ""
    echo -e "  ${CYAN}postmcp presets${RESET}                                ${DIM}# Explore 50+ API presets${RESET}"
    echo -e "  ${CYAN}postmcp inspect @stripe${RESET}                        ${DIM}# Inspect spec & Token Diet savings${RESET}"
    echo -e "  ${CYAN}postmcp run @neon${RESET}                              ${DIM}# Run in-memory MCP server${RESET}"
    echo -e "  ${CYAN}postmcp export @stripe --client cursor --write${RESET} ${DIM}# 1-click export to Cursor${RESET}"
    echo ""
    echo -e "${GREEN}========================================================================${RESET}"
else
    echo -e "${YELLOW}Installation finished, but 'postmcp' was not found on your current PATH.${RESET}" >&2
    echo "Make sure your global npm bin directory is included in PATH:" >&2
    echo "  export PATH=\"\$(npm config get prefix)/bin:\$PATH\"" >&2
fi
