<#
.SYNOPSIS
  dsh-diagram 宿主半「激活自检」：不重启正在运行的 dsh，也能验证插件能不能被宿主 import + apply。

.DESCRIPTION
  为什么需要它：宿主半的 import 级失败（缺 peer、模块定位不对）在正在运行的进程里是**不可修复**的
  —— Node 按 URL 缓存模块作业，第一次 import 失败后同一进程内再试永远拿到那条旧 rejection
  （PLAN.md §P2.10 的 C4）。所以「改完看效果」必须开一个新进程，而 desktop profile 被 Electron 独占、
  CLI 拒绝 boot（`profile "desktop" is managed exclusively by the Electron application`）。

  做法：
    1. 在 `$DSH_HOME\profiles\<临时名>` 造一个隔离 profile：`dsh-base` + 本插件，插件用目录联接（junction）
       指到仓库里的 `plugin/`；
    2. 用**安装版自带的 Electron 运行时**（`ELECTRON_RUN_AS_NODE=1 <exe>`）起 dsh，抓 stderr；
    3. 断言：组合出的 profile 里确实有本插件（`--dump-config`），且启动 stderr 里没有
       `did not activate` / `failed to import` / `ERR_MODULE_NOT_FOUND`；
    4. 删掉临时 profile（`-KeepProfile` 可保留现场）。

  自适配（换电脑/换盘/换安装位置都不用改脚本）：exe 按 `-HostExe` → `DSH_DIAGRAM_HOST_EXE`
  → 正在运行的宿主进程 → `%LOCALAPPDATA%\Programs\DeepSeek Harness` → `%ProgramFiles%` →
  注册表卸载项 的顺序探测；`$DSH_HOME` 取参数 → 环境变量 → `%USERPROFILE%\.dsh`。

  阴性对照（验证这个脚本真的能抓到问题）：把 `plugin\index.js` 临时改名再跑一次，必须失败退出。

.PARAMETER HostExe
  安装版 Electron 可执行文件（`DeepSeek Harness.exe`）。缺省自动探测。

.PARAMETER DshHome
  `$DSH_HOME`。缺省取环境变量，再缺省 `%USERPROFILE%\.dsh`。

.PARAMETER ProfileName
  自检用的临时 profile 名，缺省 `dsh-diagram-activation-check`。

.PARAMETER WaitSeconds
  启动后等多久再看 stderr（插件 import/apply 都在启动早期完成），缺省 20 秒。

.PARAMETER KeepProfile
  保留临时 profile 与输出文件，便于人工复现。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-plugin-activation.ps1
#>
[CmdletBinding()]
param(
  [string]$HostExe,
  [string]$DshHome,
  [string]$ProfileName = 'dsh-diagram-activation-check',
  [int]$WaitSeconds = 20,
  [switch]$KeepProfile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $repoRoot 'plugin'
$pluginManifestPath = Join-Path $pluginDir 'package.json'

if (-not (Test-Path -LiteralPath $pluginManifestPath -PathType Leaf)) {
  throw "找不到插件清单：$pluginManifestPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $pluginDir 'index.js') -PathType Leaf)) {
  throw "插件宿主半产物缺失：$(Join-Path $pluginDir 'index.js')（先跑一次 pnpm build:plugin）"
}
$pluginName = (Get-Content -LiteralPath $pluginManifestPath -Raw | ConvertFrom-Json).name
if ([string]::IsNullOrWhiteSpace($pluginName)) { throw 'plugin/package.json 缺少 name' }

# ── 1. 探测宿主安装目录（自适配的核心） ────────────────────────────────────────────────
# 只认「可执行文件旁边有 resources\app.asar」这一条：asar 内部路径在纯 PowerShell 里看不见
# （app.asar 是文件，不是目录），真正的可读性交给 Electron 运行时去证明。
function Test-DshHostExe([string]$candidate) {
  if ([string]::IsNullOrWhiteSpace($candidate)) { return $false }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $false }
  return Test-Path -LiteralPath (Join-Path (Split-Path -Parent $candidate) 'resources\app.asar')
}

function Find-DshHostExe {
  $candidates = New-Object System.Collections.Generic.List[string]
  if (-not [string]::IsNullOrWhiteSpace($HostExe)) { $candidates.Add($HostExe) }
  if (-not [string]::IsNullOrWhiteSpace($env:DSH_DIAGRAM_HOST_EXE)) { $candidates.Add($env:DSH_DIAGRAM_HOST_EXE) }

  foreach ($path in $candidates) {
    if (Test-DshHostExe $path) { return (Resolve-Path -LiteralPath $path).Path }
  }

  # 正在运行的宿主（宿主子进程用的是同一个 exe，所以这一条通常必中）
  foreach ($process in (Get-Process -ErrorAction SilentlyContinue)) {
    $path = $null
    try { $path = $process.Path } catch { $path = $null }
    if (Test-DshHostExe $path) { return (Resolve-Path -LiteralPath $path).Path }
  }

  # 常见安装位置
  $roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  foreach ($root in $roots) {
    $programs = Join-Path $root 'Programs'
    foreach ($base in @($root, $programs) | Where-Object { Test-Path -LiteralPath $_ }) {
      $direct = Join-Path $base 'DeepSeek Harness\DeepSeek Harness.exe'
      if (Test-DshHostExe $direct) { return (Resolve-Path -LiteralPath $direct).Path }
      foreach ($directory in (Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue)) {
        $nested = Join-Path $directory.FullName 'DeepSeek Harness.exe'
        if (Test-DshHostExe $nested) { return (Resolve-Path -LiteralPath $nested).Path }
      }
    }
  }

  # 注册表卸载项（用户级 + 机器级 + WOW6432）
  $uninstallKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($key in $uninstallKeys) {
    $entries = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like '*DeepSeek Harness*' -or $_.Publisher -like '*DeepSeek*' }
    foreach ($entry in $entries) {
      # 注册表项的字段随安装方式变化，StrictMode 下必须用 PSObject.Properties 取，不能直接点属性。
      $iconProperty = $entry.PSObject.Properties['DisplayIcon']
      $icon = if ($null -ne $iconProperty) { [string]$iconProperty.Value } else { $null }
      if (-not [string]::IsNullOrWhiteSpace($icon)) {
        $icon = $icon.Trim('"') -replace ',\d+$', ''
        if (Test-DshHostExe $icon) { return (Resolve-Path -LiteralPath $icon).Path }
      }
      $locationProperty = $entry.PSObject.Properties['InstallLocation']
      $location = if ($null -ne $locationProperty) { [string]$locationProperty.Value } else { $null }
      if (-not [string]::IsNullOrWhiteSpace($location)) {
        $fromLocation = Join-Path $location 'DeepSeek Harness.exe'
        if (Test-DshHostExe $fromLocation) { return (Resolve-Path -LiteralPath $fromLocation).Path }
      }
    }
  }

  return $null
}

$resolvedHostExe = Find-DshHostExe
if ($null -eq $resolvedHostExe) {
  throw @'
探测不到安装版 dsh（需要可执行文件旁边有 resources\app.asar）。
可用 -HostExe <路径> 或环境变量 DSH_DIAGRAM_HOST_EXE 显式指定，
例如：-HostExe "$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe"
'@
}
$hostRoot = Split-Path -Parent $resolvedHostExe
$asarPath = Join-Path $hostRoot 'resources\app.asar'
$dshBin = Join-Path $asarPath 'dsh\node_modules\@deepseek-ai\dsh\lib\bin.js'

if ([string]::IsNullOrWhiteSpace($DshHome)) {
  if (-not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) { $DshHome = $env:DSH_HOME }
  else { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
}
$profilesDir = Join-Path $DshHome 'profiles'
$profileDir = Join-Path $profilesDir $ProfileName

Write-Host '[verify-plugin-activation] 宿主可执行文件： ' $resolvedHostExe
Write-Host '[verify-plugin-activation] app.asar：       ' $asarPath
Write-Host '[verify-plugin-activation] DSH_HOME：       ' $DshHome
Write-Host '[verify-plugin-activation] 临时 profile：    ' $profileDir
Write-Host '[verify-plugin-activation] 被测插件：        ' "$pluginName（$pluginDir）"

# ── 2. 造隔离 profile ────────────────────────────────────────────────────────────────
# 安全闸：只允许删 `$DshHome\profiles\<ProfileName>` 这一个目录。
$expected = [IO.Path]::GetFullPath((Join-Path $profilesDir $ProfileName))
if ([IO.Path]::GetFullPath($profileDir) -ne $expected -or -not $expected.StartsWith([IO.Path]::GetFullPath($profilesDir))) {
  throw "拒绝操作意外的 profile 路径：$profileDir"
}
if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force }

New-Item -ItemType Directory -Force -Path (Join-Path $profileDir 'node_modules\@gjy_1992') | Out-Null

# 注意：**不能带 BOM** —— PS 5.1 的 Set-Content -Encoding utf8 会写 BOM，CLI 直接 JSON.parse 报错。
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$profileManifest = [ordered]@{
  name = 'dsh-profile-dsh-diagram-activation-check'
  private = $true
  dependencies = [ordered]@{ $pluginName = ('link:' + ($pluginDir -replace '\\', '/')) }
  dsh = [ordered]@{ profile = [ordered]@{ bundles = @('@deepseek-ai/dsh-base', $pluginName) } }
} | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $profileDir 'package.json'), $profileManifest, $utf8NoBom)
# 注释-only 的 patch 会让 boot 失败，空层必须写成 `[]`。
[IO.File]::WriteAllText((Join-Path $profileDir 'cordis.patch.yml'), "[]`n", $utf8NoBom)
[IO.File]::WriteAllText((Join-Path $profileDir 'pnpm-workspace.yaml'), "packages:`n  - .`n`nnodeLinker: hoisted`nautoInstallPeers: false`n", $utf8NoBom)

$linkPath = Join-Path $profileDir "node_modules\@gjy_1992\$($pluginName.Split('/')[-1])"
cmd /c mklink /J "$linkPath" "$pluginDir" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "创建目录联接失败：$linkPath" }

$previousElectronFlag = $env:ELECTRON_RUN_AS_NODE
$env:ELECTRON_RUN_AS_NODE = '1'
$stamp = [Guid]::NewGuid().ToString('N')
$stdoutFile = Join-Path $env:TEMP "dsh-diagram-activation-$stamp.out"
$stderrFile = "$stdoutFile.err"
$failures = New-Object System.Collections.Generic.List[string]

try {
  # ── 3a. 组合检查：确认临时 profile 真的把本插件排进了树里 ────────────────────────────
  # 没有这一步，「插件压根没被组合进来」也会以「stderr 干净」的形式假绿。
  $dumpConfig = & $resolvedHostExe --expose-internals $dshBin --profile $ProfileName --dump-config 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    $failures.Add("--dump-config 退出码 $LASTEXITCODE：`n$dumpConfig")
  } elseif ($dumpConfig -notmatch [Regex]::Escape($pluginName)) {
    $failures.Add("--dump-config 的组合结果里没有 $pluginName，说明 bundle 没被读进来。")
  }

  # ── 3b. 激活检查：新进程起 dsh，看启动 stderr ──────────────────────────────────────
  $argumentList = "--expose-internals `"$dshBin`" --profile $ProfileName"
  $process = Start-Process -FilePath $resolvedHostExe -ArgumentList $argumentList `
    -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru -NoNewWindow
  Start-Sleep -Seconds $WaitSeconds
  $stillRunning = -not $process.HasExited
  if ($stillRunning) {
    $process.Kill()
    $process.WaitForExit(5000) | Out-Null
  }

  $stderrText = if (Test-Path -LiteralPath $stderrFile) { Get-Content -LiteralPath $stderrFile -Raw } else { '' }
  if ($null -eq $stderrText) { $stderrText = '' }

  # `disabling profile plugin` / `incompatible with dsh` 覆盖 peer 兼容性预检拒载（配置里还在，但根本没被 import）
  # —— 只看 `did not activate` 会把这种情况误判成通过。
  foreach ($pattern in @('did not activate', 'failed to import', 'ERR_MODULE_NOT_FOUND', 'Cannot find package', 'disabling profile plugin', 'incompatible with dsh')) {
    if ($stderrText -match [Regex]::Escape($pattern)) {
      $failures.Add("启动 stderr 命中「$pattern」：`n$($stderrText.Trim())")
      break
    }
  }

  Write-Host ("[verify-plugin-activation] 启动后 {0} 秒进程" -f $WaitSeconds) $(if ($stillRunning) { '仍在运行（正常：profile 没有 app 面）' } else { '已自行退出' })
  if (-not [string]::IsNullOrWhiteSpace($stderrText)) {
    Write-Host '[verify-plugin-activation] 启动 stderr 原文：'
    Write-Host $stderrText.Trim()
  }
}
finally {
  if ($null -eq $previousElectronFlag) { Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
  else { $env:ELECTRON_RUN_AS_NODE = $previousElectronFlag }
  if (-not $KeepProfile) {
    if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force }
    Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
  } else {
    Write-Host "[verify-plugin-activation] 保留现场：$profileDir"
    Write-Host "[verify-plugin-activation] 输出文件：$stdoutFile / $stderrFile"
  }
}

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host '[verify-plugin-activation] ❌ 宿主半没有通过激活自检：'
  foreach ($failure in $failures) { Write-Host "  · $failure" }
  exit 1
}

Write-Host ''
Write-Host "[verify-plugin-activation] ✅ $pluginName 组合正常且启动无激活告警（宿主半可 import + apply）"
exit 0
