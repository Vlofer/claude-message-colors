# Sets the Windows Terminal font face to "<face>, Claude Corners 6" (the corner glyphs stay available). "reset" = Cascadia Mono.
# Output: "updated <file>" per changed settings file, "unchanged", or "ERROR ...". Windows Terminal reloads settings live.
param([Parameter(Mandatory)][string]$Face)
$ErrorActionPreference = 'Stop'
$family = 'Claude Corners 6'
if ($Face -eq 'reset') { $Face = 'Cascadia Mono' }
if ($Face -notmatch '^[\w .+-]{1,60}$') { 'ERROR bad font name'; exit 1 }
$value = "$Face, $family"
$files = @(
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json") | Where-Object { Test-Path $_ }
if (-not $files) { 'ERROR no Windows Terminal settings.json found'; exit 1 }
$changed = $false
foreach ($f in $files) {
  try {
    $t = [IO.File]::ReadAllText($f)
    if ($t -notmatch '"(?:face|fontFace)"\s*:') { "ERROR no font face in $f - run setup first (restart Claude Code)"; continue }
    $new = [regex]::Replace($t, '("(?:face|fontFace)"\s*:\s*")[^"]*(")', { param($m) $m.Groups[1].Value + $value + $m.Groups[2].Value })
    if ($new -ne $t) {
      if (-not (Test-Path "$f.bak-message-colors")) { Copy-Item $f "$f.bak-message-colors" }
      [IO.File]::WriteAllText($f, $new, (New-Object Text.UTF8Encoding $false))
      "updated $f"; $changed = $true
    }
  } catch { "ERROR $($_.Exception.Message)" }
}
if (-not $changed) { 'unchanged' }
