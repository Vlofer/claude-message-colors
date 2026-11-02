import type { Register } from 'claude-code'

const REPLY_BG = '#7a5c1e' // Claude's replies: vivid amber-brown; light default text stays readable (~6:1)
const VIOLET = '#221d33' // tool rows and results

const BLUE = '#1e3a5f' // the person's own prompts

const colors = {
  UserMessage: BLUE,
  AssistantMessage: REPLY_BG,
  ToolUse: VIOLET,
  ToolGroup: VIOLET,
  ToolProgress: VIOLET,
  ToolResult: VIOLET,
} as const

export const register: Register = on => {
  // Windows only: install the corner font and point Windows Terminal at it (idempotent, see scripts/setup.ps1)
  on('session.start', async ($, e, next) => {
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

  for (const component of Object.keys(colors) as (keyof typeof colors)[]) {
    on('ui.render', { component }, async ($, e, next) => {
      // other surfaces keep the engine's own drawing
      if (e.surface !== 'terminal') return next(e)

      const { Box, Text } = $.ui.resolve(e)
      const isReady = (await $.store.get('cornersReady')) === true

      // the engine paints its own background under the prompt text, so a plain prompt is drawn here in full
      if (component === 'UserMessage' && !e.props.task && !e.props.from) {
        return (
          <Box backgroundColor={BLUE} paddingX={1} marginTop={1}>
            <Text backgroundColor={BLUE} color="text">❯ {e.props.text}</Text>
          </Box>
        )
      }

      if (component !== 'AssistantMessage') {
        return <Box backgroundColor={colors[component]}>{await next(e)}</Box>
      }

      // Real round corners: U+E9F0..E9F3 are quarter-circle glyphs from the user's own "Claude Corners" font
      // (installed per user, added as a fallback in Windows Terminal; see make_font.py). Without that font the
      // corner cells are empty, so the box just has square-ish corners.
      const edge = (left: string, right: string) => (
        <Box height={1}>
          {isReady ? <Text color={REPLY_BG}>{left}</Text> : <Text backgroundColor={REPLY_BG}> </Text>}
          <Box flexGrow={1} backgroundColor={REPLY_BG} />
          {isReady ? <Text color={REPLY_BG}>{right}</Text> : <Text backgroundColor={REPLY_BG}> </Text>}
        </Box>
      )
      return (
        <Box flexDirection="column">
          {edge('', '')}
          <Box backgroundColor={REPLY_BG} paddingX={1}>{await next(e)}</Box>
          {edge('', '')}
        </Box>
      )
    })
  }
}
