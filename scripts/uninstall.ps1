# Removes everything message-colors installed or changed: fonts, registry, Windows Terminal settings, logs, the plugin and its marketplace.
# Output: one line per action, problems as "ERROR ...", last line "CLEAN" only when a final re-check finds nothing left.
$ErrorActionPreference = 'Continue'
$out = New-Object Collections.Generic.List[string]
function Say($s) { $out.Add($s) }
$fontDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
$regKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
$runOnce = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'
$pending = @() # font files that Windows still holds: deleted at next sign-in

# 1. fonts: unload, unregister, delete
try {
  Add-Type -Namespace MC -Name Un -MemberDefinition @'
[DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int RemoveFontResourceW(string path);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeoutW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
'@
  $props = (Get-ItemProperty $regKey -ErrorAction SilentlyContinue).PSObject.Properties | Where-Object { $_.Name -like 'Claude Corners*' }
  $paths = @($props | ForEach-Object { $_.Value }) + @(Get-ChildItem $fontDir -Filter 'ClaudeCorners*.ttf' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) | Select-Object -Unique
  foreach ($p in $props) { Remove-ItemProperty $regKey -Name $p.Name -ErrorAction SilentlyContinue; Say "unregistered $($p.Name)" }
  foreach ($p in $paths) {
    # only our own per-user folder: a registry value must never make us delete a file elsewhere
    if (-not $p.StartsWith($fontDir, [StringComparison]::OrdinalIgnoreCase)) { continue }
    while ([MC.Un]::RemoveFontResourceW($p) -ne 0) {}
    if (Test-Path $p) {
      try { Remove-Item $p -Force -ErrorAction Stop; Say "deleted $p" }
      catch { $pending += $p }
    }
  }
  $i = 0
  foreach ($p in $pending) {
    New-ItemProperty $runOnce -Name "MessageColorsDel$i" -Value "cmd /c del /f /q `"$p`"" -PropertyType String -Force | Out-Null
    $i++; Say "font file locked, will be deleted at next sign-in: $p"
  }
  $r = [IntPtr]::Zero
  [void][MC.Un]::SendMessageTimeoutW([IntPtr]0xFFFF, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$r)
} catch { Say "ERROR fonts: $($_.Exception.Message)" }

# 2. Windows Terminal settings: strip the fallback face setup.ps1 appended (the "Cascadia Mono" it may have added is WT's own default and stays)
$files = @(
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json")
foreach ($f in $files) {
  try {
    if (Test-Path $f) {
      $t = [IO.File]::ReadAllText($f)
      $new = [regex]::Replace($t, '("(?:face|fontFace)"\s*:\s*")([^"]*)(")', { param($m) $m.Groups[1].Value + ($m.Groups[2].Value -replace '\s*,\s*Claude Corners[^,]*', '') + $m.Groups[3].Value })
      if ($new -ne $t) { [IO.File]::WriteAllText($f, $new, (New-Object Text.UTF8Encoding $false)); Say "updated $f" }
    }
    if (Test-Path "$f.bak-message-colors") { Remove-Item "$f.bak-message-colors" -Force; Say "deleted $f.bak-message-colors" }
  } catch { Say "ERROR settings ${f}: $($_.Exception.Message)" }
}

# 3. logs
$logDir = Join-Path $env:LOCALAPPDATA 'message-colors'
if (Test-Path $logDir) { Remove-Item $logDir -Recurse -Force -ErrorAction SilentlyContinue; Say "deleted $logDir" }

# 4. plugin (its data dir goes with it) and, when nothing else is installed from it, its marketplace; last, because it deletes this script's folder
function PluginList { try { @(claude plugin list --json | ConvertFrom-Json) } catch { Say "ERROR plugin list: $($_.Exception.Message)"; @() } }
$mine = @(PluginList | Where-Object { $_.id -like 'message-colors@*' })
foreach ($p in $mine) {
  claude plugin uninstall $p.id --scope $p.scope | Out-Null
  Say "uninstalled $($p.id) ($($p.scope))"
}
foreach ($m in ($mine | ForEach-Object { $_.id.Split('@')[1] } | Select-Object -Unique)) {
  if (-not (PluginList | Where-Object { $_.id -like "*@$m" })) {
    claude plugin marketplace remove $m | Out-Null
    Say "removed marketplace $m"
  }
}

# 5. re-check
$left = @()
if ((Get-ItemProperty $regKey -ErrorAction SilentlyContinue).PSObject.Properties | Where-Object { $_.Name -like 'Claude Corners*' }) { $left += 'registry font entries' }
$ttf = @(Get-ChildItem $fontDir -Filter 'ClaudeCorners*.ttf' -ErrorAction SilentlyContinue | Where-Object { $pending -notcontains $_.FullName })
if ($ttf) { $left += 'font files' }
foreach ($f in $files) {
  if ((Test-Path $f) -and ([IO.File]::ReadAllText($f) -match 'Claude Corners')) { $left += "Claude Corners in $f" }
  if (Test-Path "$f.bak-message-colors") { $left += "$f.bak-message-colors" }
}
if (Test-Path $logDir) { $left += 'log folder' }
if (PluginList | Where-Object { $_.id -like 'message-colors@*' }) { $left += 'plugin still installed' }
if ($left) { Say "ERROR left: $($left -join '; ')" } else { Say 'CLEAN' }
$out
