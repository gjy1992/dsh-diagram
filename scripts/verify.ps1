# dsh-diagram functional verification
# 1) build-all examples -> out/*.drawio
# 2) convert every .drawio to PNG using the local draw.io desktop CLI
# Usage: pnpm verify   (or powershell -File scripts/verify.ps1)
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 files
# without a BOM as ANSI, which corrupts non-ASCII literals.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'out'
$examplesDir = Join-Path $root 'examples'

$drawioCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\draw.io\draw.io.exe'),
    (Join-Path $env:ProgramFiles 'draw.io\drawio.exe'),
    'c:\Work\trae\_tools\drawio-26.0.16.exe'
)
$drawio = $drawioCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $drawio) {
    Write-Error "draw.io desktop not found. Checked: $($drawioCandidates -join ', ')"
    exit 1
}
Write-Host "draw.io: $drawio"

# draw.io CLI detaches after spawning, so poll until the file is written and stable.
function Wait-FileReady([string]$Path, [int]$TimeoutMs = 60000) {
    $elapsed = 0
    while ($elapsed -lt $TimeoutMs) {
        if (Test-Path $Path) {
            $size = (Get-Item $Path).Length
            Start-Sleep -Milliseconds 400
            if ($size -gt 0 -and (Get-Item $Path).Length -eq $size) { return $true }
        }
        Start-Sleep -Milliseconds 400
        $elapsed += 400
    }
    return $false
}

Write-Host '==> step 1/2: render YAML -> .drawio'
Push-Location $root
pnpm exec tsx packages/core/src/cli.ts build-all $examplesDir -o $outDir
$buildExit = $LASTEXITCODE
Pop-Location
if ($buildExit -ne 0) { exit $buildExit }

Write-Host ''
Write-Host '==> step 2/2: export .drawio -> PNG'
$failed = @()
foreach ($file in (Get-ChildItem $outDir -Filter '*.drawio' | Sort-Object Name)) {
    $png = Join-Path $outDir ($file.BaseName + '.png')
    Remove-Item $png -ErrorAction SilentlyContinue
    Write-Host "  exporting $($file.Name)"
    & $drawio --export --format png --scale 2 --border 10 --output $png $file.FullName 2>$null

    if (-not (Wait-FileReady $png)) {
        Write-Warning "FAILED: no PNG produced for $($file.Name)"
        $failed += $file.Name
        continue
    }
    $info = Get-Item $png
    Write-Host ("    -> {0} ({1:N0} bytes)" -f (Split-Path $png -Leaf), $info.Length)
}

Write-Host ''
if ($failed.Count -gt 0) {
    Write-Host "FAILED files: $($failed -join ', ')"
    exit 1
}
Write-Host "All done. PNG output: $outDir"