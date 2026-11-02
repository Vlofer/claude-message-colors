import type { Register } from 'claude-code'

import { apply, describe, parseArgs, resolve, type Settings, type Slot } from './colors.ts'

// which customizable slot each drawn component belongs to (defaults live in colors.ts)
const slots = {
  UserMessage: 'user',
  AssistantMessage: 'reply',
  ToolUse: 'tool',
  ToolGroup: 'tool',
  ToolProgress: 'tool',
  ToolResult: 'tool',
} as const satisfies Record<string, Slot>

const run = ($: { plugin: { root: string }; process: { run: (a: string[]) => Promise<{ stdout: string; stderr: string }> } }, script: string, ...args: string[]) =>
  $.process.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/${script}`, ...args])

export const register: Register = on => {
  // Windows only: install the corner font and point Windows Terminal at it (idempotent, see scripts/setup.ps1)
  on('session.start', async ($, e, next) => {
    // dash twins of the /message-colors:<name> commands, in case the engine only hands registered names to command.run
    for (const [name, description] of [['bg', 'Set the background color of prompts, replies or tool runs'], ['fg', 'Set the text color of prompts or replies'], ['font', 'Change the Windows Terminal font']]) {
      await $.command.register({ name: `message-colors-${name}`, description, argumentHint: '<args>' })
    }
    await $.command.register({ name: 'message-colors-uninstall', description: 'Remove message-colors and everything it installed (font, Windows Terminal settings, plugin)' })
    // after /message-colors-uninstall a reload in the same session must not install the font again
    if ((await $.store.get('uninstalled')) === true) return next(e)
    let isReady = false
    try {
      const { stdout, stderr } = await $.process.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/setup.ps1`])
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      const error = lines.find(l => l.startsWith('ERROR')) ?? (stderr.trim() ? `ERROR ${stderr.trim().split('\n')[0]}` : undefined)
      const isChanged = lines.some(l => l === 'font installed' || l.startsWith('updated '))
      // corners are drawn only on a run that changed nothing: after a change Windows Terminal still has to be restarted
      isReady = lines.includes('READY') && !isChanged
      if (error) $.ui.toast(`message-colors: ${error} (log: %LOCALAPPDATA%/message-colors/setup.log)`)
      else if (isChanged) $.ui.toast('message-colors: font set up - close all Windows Terminal windows, reopen, start a new session (sign out of Windows if corners still show ? boxes)')
    } catch {
      // not Windows or no PowerShell: replies get square corners
    }
    await $.store.set('cornersReady', isReady)
    return next(e)
  })

  // /message-colors:bg and :fg - settings are kept in the plugin store and read on every draw
  for (const kind of ['bg', 'fg'] as const) {
    for (const command of [`message-colors:${kind}`, `message-colors-${kind}`]) on('command.run', { command }, async ($, e) => {
      const parsed = parseArgs(e.args, kind)
      const settings = ((await $.store.get('colors')) ?? {}) as Settings
      if (!parsed.ok) return { text: parsed.error }
      if (parsed.show) return { text: describe(settings) }
      const next = apply(settings, kind, parsed.slot, parsed.tint)
      await $.store.set('colors', next)
      const note = kind === 'fg' && parsed.tint && parsed.slot !== 'user' ? '\nNote: a reply with its own text color is drawn as plain text (no markdown formatting).' : ''
      return { text: `${describe(next)}${note}` }
    })
  }

  for (const command of ['message-colors:font', 'message-colors-font']) on('command.run', { command }, async ($, e) => {
    const face = e.args.trim()
    if (!/^(reset|[\w .+-]{1,60})$/.test(face)) return { text: 'Usage: /message-colors:font <font name, e.g. Consolas>  |  reset' }
    try {
      const { stdout, stderr } = await run($, 'font.ps1', face)
      return { text: `${stdout.trim()}${stderr.trim() ? `\nERROR ${stderr.trim()}` : ''}` }
    } catch (err) {
      return { text: `ERROR font change failed: ${String(err)}` }
    }
  })

  on('command.run', { command: 'message-colors-uninstall' }, async $ => {
    await $.store.set('uninstalled', true)
    try {
      const { stdout, stderr } = await $.process.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/uninstall.ps1`])
      return { text: `${stdout.trim()}${stderr.trim() ? `\nERROR ${stderr.trim()}` : ''}\nRestart Windows Terminal and Claude Code to finish.` }
    } catch (err) {
      await $.store.set('uninstalled', false)
      return { text: `ERROR uninstall failed: ${String(err)}. Run scripts/uninstall.ps1 by hand.` }
    }
  })

  for (const component of Object.keys(slots) as (keyof typeof slots)[]) {
    on('ui.render', { component }, async ($, e, next) => {
      // other surfaces keep the engine's own drawing
      if (e.surface !== 'terminal') return next(e)

      const { Box, Text } = $.ui.resolve(e)
      const isReady = (await $.store.get('cornersReady')) === true
      const { bg, fg } = resolve(((await $.store.get('colors')) ?? {}) as Settings, slots[component])

      // the engine paints its own background under the prompt text, so a plain prompt is drawn here in full
      if (component === 'UserMessage' && !e.props.task && !e.props.from) {
        return (
          <Box backgroundColor={bg} paddingX={1} marginTop={1}>
            <Text backgroundColor={bg} color={fg ?? 'text'}>❯ {e.props.text}</Text>
          </Box>
        )
      }

      if (component !== 'AssistantMessage') {
        return <Box backgroundColor={bg}>{await next(e)}</Box>
      }

      // Real round corners: U+E9F0..E9F3 are quarter-circle glyphs from the user's own "Claude Corners" font
      // (installed per user, added as a fallback in Windows Terminal; see make_font.py). Without that font the
      // corner cells are empty, so the box just has square-ish corners.
      const edge = (left: string, right: string) => (
        <Box height={1}>
          {isReady ? <Text color={bg}>{left}</Text> : <Text backgroundColor={bg}> </Text>}
          <Box flexGrow={1} backgroundColor={bg} />
          {isReady ? <Text color={bg}>{right}</Text> : <Text backgroundColor={bg}> </Text>}
        </Box>
      )
      return (
        <Box flexDirection="column">
          {edge('', '')}
          <Box backgroundColor={bg} paddingX={1}>{fg ? <Text color={fg}>{e.props.text}</Text> : await next(e)}</Box>
          {edge('', '')}
        </Box>
      )
    })
  }
}
