<#
    Registers the Иликон database as a DBeaver connection.

        powershell -ExecutionPolicy Bypass -File scripts\dbeaver-connect.ps1

    Why a script instead of clicking through the GUI: DBeaver keeps its
    connection list in a plain-text `data-sources.json`, so the connection can be
    written directly. Two things it deliberately does NOT do:

      * It does not write the password. DBeaver stores credentials in
        `credentials-config.json`, which is AES-encrypted with a local key —
        forging it is fragile and would put the password on disk in a file this
        script does not own. The connection is created with
        `save-password: false`, so DBeaver asks once and stores it itself.

      * It does not kill DBeaver. DBeaver rewrites `data-sources.json` when it
        exits, which would silently discard whatever this script wrote, so it
        refuses to run while DBeaver is open rather than racing it. Close
        DBeaver first. Use -Force to write anyway.

    The existing config is backed up next to the original before any change.
#>
[CmdletBinding()]
param(
    [string] $DbHost   = 'localhost',
    [string] $Port     = '5439',
    [string] $Database = 'ilikon',
    [string] $User     = 'ilikon',
    # ASCII on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI,
    # so a Cyrillic literal here would be written to the JSON double-encoded
    # and show up in DBeaver as mojibake. Rename it in DBeaver if you want
    # Cyrillic - DBeaver writes its own config correctly.
    [string] $Name     = 'Ilikon (local Postgres)',
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$configDir = Join-Path $env:APPDATA 'DBeaverData\workspace6\General\.dbeaver'
$configPath = Join-Path $configDir 'data-sources.json'

if (-not (Test-Path $configPath)) {
    Write-Host "DBeaver config not found at:" -ForegroundColor Red
    Write-Host "  $configPath"
    Write-Host "Open DBeaver once so it creates its workspace, then re-run this script."
    exit 1
}

$running = Get-Process dbeaver -ErrorAction SilentlyContinue
if ($running -and -not $Force) {
    Write-Host "DBeaver is running (pid $($running.Id))." -ForegroundColor Yellow
    Write-Host "It overwrites data-sources.json on exit, which would discard this change."
    Write-Host ""
    Write-Host "  1. Close DBeaver"
    Write-Host "  2. Re-run this script"
    Write-Host "  3. Open DBeaver - the connection will be in the Database Navigator"
    exit 2
}

# ── back up before touching anything ──────────────────────────────────────
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$configPath.bak-$stamp"
Copy-Item $configPath $backup
Write-Host "Backed up existing config -> $(Split-Path $backup -Leaf)" -ForegroundColor DarkGray

# ── merge the connection in, preserving every existing one ────────────────
$json = Get-Content $configPath -Raw | ConvertFrom-Json

if (-not $json.connections) {
    $json | Add-Member -NotePropertyName connections -NotePropertyValue ([pscustomobject]@{}) -Force
}

$connectionId = 'postgres-ilikon-local'

$configuration = [ordered]@{
    host              = $DbHost
    port              = $Port
    database          = $Database
    url               = "jdbc:postgresql://${DbHost}:${Port}/${Database}"
    configurationType = 'MANUAL'
    type              = 'dev'
    'auth-model'      = 'native'
    user              = $User
    properties        = [ordered]@{}
    'provider-properties' = [ordered]@{
        '@dbeaver-show-non-default-db@' = 'true'
    }
}

$connection = [ordered]@{
    provider        = 'postgresql'
    driver          = 'postgres-jdbc'
    name            = $Name
    description     = 'Ilikon (Uujim Pharmacy) - application database'
    'save-password' = $false
    configuration   = $configuration
}

$json.connections | Add-Member -NotePropertyName $connectionId `
    -NotePropertyValue ([pscustomobject]$connection) -Force

# Depth 20 covers the nested configuration object. Written through .NET with
# an explicit no-BOM UTF-8 encoder: `Set-Content -Encoding utf8` emits a BOM on
# Windows PowerShell 5.1, and DBeaver's own file does not have one.
$out = $json | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($configPath, $out, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Connection registered:" -ForegroundColor Green
Write-Host "  $Name"
Write-Host "  jdbc:postgresql://${DbHost}:${Port}/${Database}  (user: $User)"
Write-Host ""
Write-Host "Open DBeaver and connect. It will ask for the password once:"
Write-Host "  ilikon_dev_password" -ForegroundColor Cyan
Write-Host ""
Write-Host "If DBeaver offers to download the PostgreSQL driver, accept it."
