# Idempotent: installs the Claude Corners font per user and adds it as a fallback face in Windows Terminal.
# Output: one line per change ("font installed", "updated <file>"), problems as "ERROR ...", and a last line
# "READY" only when the font is registered and every Windows Terminal settings file already names it.
$ErrorActionPreference = 'Stop'
$logDir = Join-Path $env:LOCALAPPDATA 'message-colors'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'setup.log'
$out = New-Object Collections.Generic.List[string]
function Say($s) { $out.Add($s) }
try {
  $family = 'Claude Corners 6'
  $src = Join-Path $PSScriptRoot '..\assets\ClaudeCorners6.ttf'
  $dir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
  $dst = Join-Path $dir 'ClaudeCorners6.ttf'
  $regKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
  $regName = "$family (TrueType)"
  $registered = (Test-Path $dst) -and ((Get-ItemProperty $regKey -ErrorAction SilentlyContinue).$regName -eq $dst)
  if (-not $registered) {
    New-Item -ItemType Directory -Force $dir | Out-Null
    if (-not (Test-Path $dst)) { Copy-Item $src $dst }
    New-ItemProperty $regKey -Name $regName -Value $dst -PropertyType String -Force | Out-Null
    Say 'font installed'
  }
  # Explorer's "Install" also does this: without it a per-user font can stay invisible to Windows Terminal until sign-out
  try {
    Add-Type -Namespace MC -Name Win -MemberDefinition @'
[DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int AddFontResourceW(string path);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeoutW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
'@
    [void][MC.Win]::AddFontResourceW($dst)
    $r = [IntPtr]::Zero
    [void][MC.Win]::SendMessageTimeoutW([IntPtr]0xFFFF, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$r)
  } catch { Say "ERROR font refresh: $($_.Exception.Message)" }
  $files = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json") | Where-Object { Test-Path $_ }
  if (-not $files) { Say 'ERROR no Windows Terminal settings.json found' }
  $allPatched = [bool]$files
  foreach ($f in $files) {
    $t = [IO.File]::ReadAllText($f)
    # a fresh Windows Terminal has no font face: Cascadia Mono is its default, keep it first
    $face = "Cascadia Mono, $family"
    $withFace = [regex]'("defaults"\s*:\s*\{[^}]*?"face"\s*:\s*")'
    $withFont = [regex]'("defaults"\s*:\s*\{[^}]*?"font"\s*:\s*\{)(\s*)(\}?)'
    $bare = [regex]'("defaults"\s*:\s*\{)(\s*)(\}?)'
    $new = $t
    if ($withFace.IsMatch($t)) {
      # defaults already has a face: the all-faces pass below appends to it
    } elseif ($withFont.IsMatch($t)) {
      $new = $withFont.Replace($t, { param($m) $m.Groups[1].Value + " `"face`": `"$face`"" + $(if ($m.Groups[3].Value) { ' ' } else { ',' }) + $m.Groups[2].Value + $m.Groups[3].Value }, 1)
    } elseif ($bare.IsMatch($t)) {
      $new = $bare.Replace($t, { param($m) $m.Groups[1].Value + " `"font`": { `"face`": `"$face`" }" + $(if ($m.Groups[3].Value) { ' ' } else { ',' }) + $m.Groups[2].Value + $m.Groups[3].Value }, 1)
    } else { Say "ERROR no profiles.defaults in $f - add `"$family`" to the font face by hand"; $allPatched = $false; continue }
    # profiles can override defaults, so every face (and the old fontFace key) gets the fallback
    $new = [regex]::Replace($new, '("(?:face|fontFace)"\s*:\s*")([^"]*)(")', { param($m) if ($m.Groups[2].Value.Contains($family)) { $m.Value } else { $m.Groups[1].Value + $m.Groups[2].Value + ', ' + $family + $m.Groups[3].Value } })
    if ($new -ne $t) {
      Copy-Item $f "$f.bak-message-colors" -Force
      [IO.File]::WriteAllText($f, $new, (New-Object Text.UTF8Encoding $false))
      Say "updated $f"
    }
  }
  if ($allPatched -and -not ($out | Where-Object { $_ -notlike 'ERROR*' })) { Say 'READY' }
} catch {
  Say "ERROR $($_.Exception.Message)"
}
$out | Set-Content $log -Encoding utf8
$out
