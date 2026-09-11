#!/usr/bin/env bash
# PostMCP Installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/BraveRam/postmcp/main/install.sh | bash

set -euo pipefail

PACKAGE="@postmcp/cli"

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

# 1. Environment & Runtime Check
if ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
    echo "Error: Node.js (v18+) or Bun is required but not installed." >&2
    echo "Please install Bun from https://bun.sh or Node.js from https://nodejs.org" >&2
    exit 1
fi

if command -v node >/dev/null 2>&1; then
    NODE_VERSION="$(node -v | sed 's/^v//')"
    NODE_MAJOR="$(echo "${NODE_VERSION}" | cut -d. -f1)"
    if [ "${NODE_MAJOR}" -lt 18 ]; then
        echo -e "${YELLOW}Warning: Node.js version ${NODE_VERSION} detected. PostMCP recommends Node.js 18 or higher.${RESET}" >&2
    fi
fi

# 2. Select Package Manager in speed order: bun -> pnpm -> npm
PM=""
INSTALL_CMD=""

if command -v bun >/dev/null 2>&1; then
    PM="bun"
    INSTALL_CMD="bun add -g ${PACKAGE}@latest"
elif command -v pnpm >/dev/null 2>&1; then
    PM="pnpm"
    INSTALL_CMD="pnpm add -g ${PACKAGE}@latest"
elif command -v npm >/dev/null 2>&1; then
    PM="npm"
    INSTALL_CMD="npm install -g ${PACKAGE}@latest"
elif command -v yarn >/dev/null 2>&1; then
    PM="yarn"
    INSTALL_CMD="yarn global add ${PACKAGE}@latest"
else
    echo "Error: No supported package manager found (bun, pnpm, npm, yarn)." >&2
    echo "Please install Bun (https://bun.sh) or npm (https://nodejs.org)." >&2
    exit 1
fi

echo -e "Installing ${BOLD}${PACKAGE}${RESET} via ${CYAN}${PM}${RESET} (fastest available)..."

# 3. Installation Execution
INSTALLED=false

# 3a. Try standard install
if eval "${INSTALL_CMD}" 2>/dev/null; then
    INSTALLED=true
fi

# 3b. For npm: if standard install failed (permissions), try ~/.local prefix
if [ "${INSTALLED}" = "false" ] && [ "${PM}" = "npm" ]; then
    echo -e "${YELLOW}Global system directory is not writable without root permissions.${RESET}"
    echo "Attempting user-level installation into ~/.local..."
    mkdir -p "${HOME}/.local"
    if npm install -g --prefix "${HOME}/.local" "${PACKAGE}@latest" 2>/dev/null; then
        INSTALLED=true
        if [ -d "${HOME}/.local/bin" ]; then
            export PATH="${HOME}/.local/bin:${PATH}"
        fi
    fi
fi

# 3c. If user prefix failed and sudo is available, try sudo preserving user PATH
if [ "${INSTALLED}" = "false" ]; then
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        echo -e "${YELLOW}Attempting installation with sudo...${RESET}"
        PM_PATH="$(command -v "${PM}" || true)"
        NODE_DIR="$(dirname "$(command -v node 2>/dev/null || command -v bun 2>/dev/null)" || true)"
        if [ -n "${PM_PATH}" ] && [ -x "${PM_PATH}" ]; then
            if sudo env "PATH=${PATH}:${NODE_DIR}:/usr/local/bin:/usr/bin" "${PM_PATH}" install -g "${PACKAGE}@latest"; then
                INSTALLED=true
            fi
        fi
    fi
fi

if [ "${INSTALLED}" = "false" ]; then
    echo "" >&2
    echo "Error: Failed to install ${PACKAGE}." >&2
    echo "Please try running manually:" >&2
    echo "  ${INSTALL_CMD}" >&2
    exit 1
fi

# 4. PATH Resolution & Verification
USER_PATH_WARN=""
if ! command -v postmcp >/dev/null 2>&1; then
    for candidate in \
        "${BUN_INSTALL:-$HOME/.bun}/bin" \
        "${PNPM_HOME:-$HOME/.local/share/pnpm}" \
        "$HOME/.local/bin" \
        "$HOME/.npm-global/bin" \
        "$(npm config get prefix 2>/dev/null || true)/bin"; do
        if [ -n "${candidate}" ] && [ -x "${candidate}/postmcp" ]; then
            export PATH="${candidate}:${PATH}"
            USER_PATH_WARN="${candidate}"
            break
        fi
    done
fi

if command -v postmcp >/dev/null 2>&1; then
    INSTALLED_VER="$(postmcp --version 2>/dev/null || echo 'v0.1.21')"
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
    if [ -n "${USER_PATH_WARN}" ]; then
        echo ""
        echo -e "${YELLOW}Note: '${USER_PATH_WARN}' is not in your default shell PATH.${RESET}"
        echo "To use 'postmcp' from any terminal, add it to your shell profile:"
        echo -e "  ${CYAN}export PATH=\"${USER_PATH_WARN}:\$PATH\"${RESET}"
        if [ -n "${FISH_VERSION:-}" ] || [[ "${SHELL:-}" == *"fish"* ]]; then
            echo -e "Or for fish shell:"
            echo -e "  ${CYAN}fish_add_path ${USER_PATH_WARN}${RESET}"
        fi
    fi
else
    echo -e "${YELLOW}Installation completed, but 'postmcp' was not found on your current PATH.${RESET}" >&2
    echo "Ensure your global bin directory is included in PATH." >&2
fi
