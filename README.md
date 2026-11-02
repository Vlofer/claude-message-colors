# message-colors

A Claude Code plugin that restyles the terminal UI:

- Claude's replies get an amber-brown background with **rounded corners**.
- Tool calls, progress and results get a dark violet background.

Terminal only. Other surfaces (desktop, VS Code) keep the normal look.

## Install

```
/plugin install message-colors --marketplace Vlofer/claude-message-colors
```

Answer `y` to add the marketplace, then pick a scope. Restart Windows Terminal once after the first session.

## How it works

- `hooks/register.tsx` hooks `ui.render` and wraps replies and tool rows in colored boxes.
- Terminals cannot draw a rounded corner on a background color, so the plugin ships a tiny font, **Claude Corners** (`assets/ClaudeCorners6.ttf`), with four quarter-circle glyphs (U+E9F0 to U+E9F3). The reply box draws them in its corners.
- On the first session start the plugin runs `scripts/setup.ps1`, which:
  1. copies the font to `%LOCALAPPDATA%\Microsoft\Windows\Fonts` and registers it for the current user (no admin rights);
  2. appends `Claude Corners 6` as a fallback face to `profiles.defaults.font.face` in the Windows Terminal `settings.json` (a backup `settings.json.bak-message-colors` is made first).

  The script is idempotent: later sessions change nothing.

## Requirements and limits

- Rounded corners need **Windows + Windows Terminal**. Elsewhere the colors still work and the corners are square.
- If your Windows Terminal `profiles.defaults` has no `font.face`, the script does not edit the settings and prints a hint: add `, Claude Corners 6` to your font face by hand.

## Customize

- Colors: `REPLY_BG` and `VIOLET` at the top of `hooks/register.tsx`.
- Font: edit the constants in `make_font.py` and run `python make_font.py <out.ttf> "<family name>"` (standard library only).

## Uninstall

`/plugin uninstall message-colors`. To remove the font, delete `ClaudeCorners6.ttf` from `%LOCALAPPDATA%\Microsoft\Windows\Fonts`, the `Claude Corners 6 (TrueType)` value under `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts`, and `, Claude Corners 6` from the Windows Terminal font face.
