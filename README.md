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

Run one command in Claude Code (both names do the same):

```
/message-colors:uninstall
/message-colors-uninstall
```

"Unknown command" means an older version is installed. Update first, then start a new session:

```
claude plugin marketplace update message-colors
claude plugin update message-colors@message-colors
```

It removes the font files and their registry entries, strips `Claude Corners` from the Windows Terminal font face (and deletes the `.bak-message-colors` backups), deletes `%LOCALAPPDATA%\message-colors`, uninstalls the plugin with its data and removes its marketplace if nothing else is installed from it. It ends with `CLEAN` after re-checking, or `ERROR left: ...`. A font file Windows still holds is deleted at your next sign-in. Restart Windows Terminal afterwards.

Without Claude: `powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1`.

## Customize colors and font

Changes apply at once and are remembered. Every command also works with a dash (`/message-colors-bg`).

```
/message-colors:bg <user|reply|tool> <#hex> [alpha%]   background
/message-colors:fg <user|reply> <#hex> [alpha%]        text color
/message-colors:font <font name>                       Windows Terminal font (keeps the rounded corners)
```

### Targets

`<user|reply|tool>` means "pick one of these three":

| Target | What it colors | Default |
|---|---|---|
| `user` | your own prompts | blue `#1e3a5f` |
| `reply` | Claude's replies | amber-brown `#7a5c1e` |
| `tool` | tool calls and their results (`bg` only) | violet `#221d33` |

### Arguments

- `#hex` is `#rgb` or `#rrggbb`, for example `#2a4d2a`.
- `alpha` is optional, 0-100 (`70` or `70%`), default 100. A terminal has no real transparency, so it fades the color toward what is behind it: a background toward the terminal's black, a text color toward its own background.
- `reset` restores the defaults: after a target (`/message-colors:bg tool reset`) or alone for all targets (`/message-colors:fg reset`).
- A command without arguments shows the current values.

### Examples

```
/message-colors:bg user #1e3a5f
/message-colors:bg reply #2a4d2a 70%
/message-colors:fg user #ffcc00
/message-colors:bg tool reset
/message-colors:font Consolas
/message-colors:font reset
```

### Limits

- The engine draws replies and tool rows itself and lets a plugin change only their background. Tool text color cannot be changed.
- A reply gets its own text color only if you set `fg reply`; it is then shown as plain text without markdown formatting (bold, code, lists).
- `font` changes the whole terminal, not single messages. `font reset` returns to Cascadia Mono.
