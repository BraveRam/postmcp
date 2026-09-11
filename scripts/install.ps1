# PostMCP Installer for Windows (PowerShell)
# Usage: irm https://raw.githubusercontent.com/BraveRam/postmcp/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$PackageName = "postmcp"

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host " PostMCP Installer for Windows" -ForegroundColor Cyan
Write-Host " The Postman for MCP: Turn OpenAPI into Safe, Context-Optimized MCP Servers" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan

# 1. Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required but was not found. Please install Node.js (v18+) from https://nodejs.org"
    exit 1
}

# 2. Check for npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is required but was not found."
    exit 1
}

Write-Host "Installing $PackageName globally via npm..." -ForegroundColor Green

try {
    npm install -g "$PackageName@latest"
} catch {
    Write-Error "Failed to install $PackageName globally. Try running PowerShell as Administrator."
    exit 1
}

# 3. Verify Installation
if (Get-Command postmcp -ErrorAction SilentlyContinue) {
    $Version = (postmcp --version 2>$null)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Green
    Write-Host "PostMCP $Version installed successfully!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To launch the Visual Web Studio and documentation, run:" -ForegroundColor White
    Write-Host ""
    Write-Host "  postmcp studio" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  * Studio Workbench:    http://localhost:3000" -ForegroundColor DarkGray
    Write-Host "  * Built-in Docs:       http://localhost:3000/docs" -ForegroundColor DarkGray
    Write-Host "  * Open Docs directly:  postmcp docs" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "------------------------------------------------------------------------" -ForegroundColor Green
    Write-Host "Quickstart CLI Commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "  postmcp presets                                # Explore 50+ API presets" -ForegroundColor Cyan
    Write-Host "  postmcp inspect @stripe                        # Inspect spec & Token Diet savings" -ForegroundColor Cyan
    Write-Host "  postmcp run @neon                              # Run in-memory MCP server" -ForegroundColor Cyan
    Write-Host "  postmcp export @stripe --client cursor --write # 1-click export to Cursor" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Green
} else {
    $NpmPrefix = (npm config get prefix).Trim()
    Write-Warning "'postmcp' was installed but is not on your current PATH."
    Write-Warning "Ensure '$NpmPrefix' is included in your User PATH environment variable."
}
