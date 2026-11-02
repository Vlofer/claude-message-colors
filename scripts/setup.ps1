# Idempotent: installs the Claude Corners font per user and adds it as a fallback face in Windows Terminal.
$ErrorActionPreference = 'Stop'
$family = 'Claude Corners 6'
$src = Join-Path $PSScriptRoot '..\assets\ClaudeCorners6.ttf'
$dir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
$dst = Join-Path $dir 'ClaudeCorners6.ttf'
if (-not (Test-Path $dst)) {
  New-Item -ItemType Directory -Force $dir | Out-Null
  Copy-Item $src $dst
  New-ItemProperty 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts' -Name "$family (TrueType)" -Value $dst -PropertyType String -Force | Out-Null
  'font installed'
}
$files = @(
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json")
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  $t = [IO.File]::ReadAllText($f)
  if ($t -match [regex]::Escape($family)) { continue }
  # a fresh Windows Terminal has no font face: Cascadia Mono is its default, keep it first
  $face = "Cascadia Mono, $family"
  $withFace = [regex]'("defaults"\s*:\s*\{[^}]*?"face"\s*:\s*")([^"]*)(")'
  $withFont = [regex]'("defaults"\s*:\s*\{[^}]*?"font"\s*:\s*\{)(\s*)(\}?)'
  $bare = [regex]'("defaults"\s*:\s*\{)(\s*)(\}?)'
  if ($withFace.IsMatch($t)) {
    $new = $withFace.Replace($t, { param($m) $m.Groups[1].Value + $m.Groups[2].Value + ', ' + $family + $m.Groups[3].Value }, 1)
  } elseif ($withFont.IsMatch($t)) {
    $new = $withFont.Replace($t, { param($m) $m.Groups[1].Value + " `"face`": `"$face`"" + $(if ($m.Groups[3].Value) { ' ' } else { ',' }) + $m.Groups[2].Value + $m.Groups[3].Value }, 1)
  } elseif ($bare.IsMatch($t)) {
    $new = $bare.Replace($t, { param($m) $m.Groups[1].Value + " `"font`": { `"face`": `"$face`" }" + $(if ($m.Groups[3].Value) { ' ' } else { ',' }) + $m.Groups[2].Value + $m.Groups[3].Value }, 1)
  } else { "no profiles.defaults in $f - add `"$family`" to the font face by hand"; continue }
  Copy-Item $f "$f.bak-message-colors" -Force
  [IO.File]::WriteAllText($f, $new, (New-Object Text.UTF8Encoding $false))
  "updated $f"
}
