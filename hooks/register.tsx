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
    let isReady = false
    try {
      const { stdout, stderr } = await $.process.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/scripts/setup.ps1`])
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      const error = lines.find(l => l.startsWith('ERROR')) ?? (stderr.trim() ? `ERROR ${stderr.trim().split('\n')[0]}` : undefined)
      const isChanged = lines.some(l => l === 'font installed' || l.startsWith('updated '))
      // corners are drawn only on a run that changed nothing: after a change Windows Terminal still has to be restarted
      isReady = lines.includes('READY') && !isChanged
      if (error) $.ui.toast(`message-colors: ${error} (log: %LOCALAPPDATA%/message-colors/setup.log)`)
      else if (isChanged) $.ui.toast('message-colors: font set up - close all Windows Terminal windows, reopen, start a new session')
    } catch {
      // not Windows or no PowerShell: replies get square corners
    }
    await $.store.set('cornersReady', isReady)
    return next(e)
  })

  for (const component of Object.keys(colors) as (keyof typeof colors)[]) {
    on('ui.render', { component }, async ($, e, next) => {
      // other surfaces keep the engine's own drawing
      if (e.surface !== 'terminal') return next(e)

      const { Box, Text } = $.ui.resolve(e)
      const isReady = (await $.store.get('cornersReady')) === true

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
