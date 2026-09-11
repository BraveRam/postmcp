# PostMCP Installer for Windows (PowerShell)
# Usage: irm https://raw.githubusercontent.com/BraveRam/postmcp/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$PackageName = "@postmcp/cli"

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host " PostMCP Installer for Windows" -ForegroundColor Cyan
Write-Host " The Postman for MCP: Turn OpenAPI into Safe, Context-Optimized MCP Servers" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan

# 1. Environment & Runtime Check
$HasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$HasBun = [bool](Get-Command bun -ErrorAction SilentlyContinue)

if (-not $HasNode -and -not $HasBun) {
    Write-Error "Node.js (v18+) or Bun is required. Please install Node.js from https://nodejs.org or Bun from https://bun.sh"
    exit 1
}

# 2. Select Package Manager in speed order: bun -> pnpm -> npm
$PM = ""
$InstallCmd = ""

if (Get-Command bun -ErrorAction SilentlyContinue) {
    $PM = "bun"
    $InstallCmd = "bun add -g $PackageName@latest"
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $PM = "pnpm"
    $InstallCmd = "pnpm add -g $PackageName@latest"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $PM = "npm"
    $InstallCmd = "npm install -g $PackageName@latest"
} else {
    Write-Error "No supported package manager found (bun, pnpm, npm)."
    exit 1
}

Write-Host "Installing $PackageName via $PM (fastest available)..." -ForegroundColor Green

try {
    Invoke-Expression $InstallCmd
} catch {
    Write-Error "Failed to install $PackageName. Try running PowerShell as Administrator."
    exit 1
}

# 3. Verify Installation
if (Get-Command postmcp -ErrorAction SilentlyContinue) {
    $Version = (postmcp --version 2>$null)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Green
    if ($Version) {
        Write-Host "PostMCP $Version installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "PostMCP installed successfully!" -ForegroundColor Green
    }
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
    Write-Warning "'postmcp' was installed but is not on your current PATH."
    Write-Warning "Ensure your package manager global bin directory is in your User PATH environment variable."
}
