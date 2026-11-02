---
description: Remove message-colors and everything it installed (font, Windows Terminal settings, plugin)
allowed-tools: Bash(powershell.exe:*)
---

Run this exactly once and show its output verbatim, without commentary:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/uninstall.ps1"
```

The last line is `CLEAN` when everything was removed, or `ERROR left: ...` listing what remains. Then tell the user to restart Windows Terminal and Claude Code.
