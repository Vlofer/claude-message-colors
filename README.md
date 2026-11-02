# message-colors

A Claude Code plugin that restyles the terminal UI:

- Claude's replies get an amber-brown background with **rounded corners**.
- Your own prompts get a blue background.
- Tool calls, progress and results get a dark violet background.
- All colors and the font can be changed with `/message-colors:` commands.

Terminal only. Other surfaces (desktop, VS Code) keep the normal look.

## Install

```
/plugin install message-colors --marketplace Vlofer/claude-message-colors
```

Answer `y` to add the marketplace, then pick a scope.

> [!IMPORTANT]
> After the first session **close all Windows Terminal windows, reopen, and start a new Claude Code session**. Until then the corners are square. If they still show `?` boxes, sign out of Windows once.

## How it works

- `hooks/register.tsx` hooks `ui.render` and draws your prompts, replies and tool rows in colored boxes (colors and settings logic: `hooks/colors.ts`).
- Terminals cannot draw a rounded corner on a background color, so the plugin ships a tiny font, **Claude Corners** (`assets/ClaudeCorners6.ttf`), with four quarter-circle glyphs (U+E9F0 to U+E9F3). The reply box draws them in its corners.
- On every session start the plugin runs `scripts/setup.ps1`, which:
  1. copies the font to `%LOCALAPPDATA%\Microsoft\Windows\Fonts` and registers it for the current user (no admin rights);
  2. appends `Claude Corners 6` as a fallback face to every font face in the Windows Terminal `settings.json` (a fresh terminal without a face gets `Cascadia Mono, Claude Corners 6`); a backup `settings.json.bak-message-colors` is made first.

  The script is idempotent: once everything is set up, later sessions change nothing. Problems are written to `%LOCALAPPDATA%\message-colors\setup.log` and shown as a toast.

## Requirements and limits

- Rounded corners need **Windows + Windows Terminal**. Elsewhere the colors still work and the corners are square.
- Until the font is set up and Windows Terminal is restarted, the reply box has square corners instead of `?` boxes.

## Customize the code

- Default colors: `DEFAULT_BG` in `hooks/colors.ts` (the commands below need no editing). Tests: `node hooks/colors.test.ts`.
- Font: edit the constants in `make_font.py` and run `python make_font.py <out.ttf> "<family name>"` (standard library only).

## Customize colors and font

> [!NOTE]
> Changes apply at once and are remembered. Every command also works with a dash (`/message-colors-bg`).

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

> [!WARNING]
> **Tool text color cannot be changed**, and **`fg reply` turns replies into plain text** (no bold, code or lists).

- The engine draws replies and tool rows itself and lets a plugin change only their **background**.
- A reply gets its own text color only if you set `fg reply`.
- `font` changes the whole terminal, not single messages. `font reset` returns to Cascadia Mono.

## Uninstall

> [!CAUTION]
> This removes the font, the Windows Terminal font edit and the plugin itself.

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

It removes the font files and their registry entries, strips `Claude Corners` from the Windows Terminal font face (and deletes the `.bak-message-colors` backups), deletes `%LOCALAPPDATA%\message-colors`, uninstalls the plugin with its data and removes its marketplace if nothing else is installed from it. It ends with `CLEAN` after re-checking, or `ERROR left: ...`. A font file Windows still holds is deleted at your next sign-in. **Restart Windows Terminal afterwards.**

Without Claude: `powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1`.
