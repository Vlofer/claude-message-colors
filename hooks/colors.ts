// Pure helpers for the /message-colors:bg and :fg commands (no engine imports, so they can be tested with plain node).

export type Slot = 'user' | 'reply' | 'tool'
export type Tint = { hex: string; alpha: number } // alpha 0-100
export type Setting = { bg?: Tint; fg?: Tint }
export type Settings = Partial<Record<Slot, Setting>>

export const TERMINAL_BG = '#0c0c0c' // what a fully "transparent" background fades into
export const DEFAULT_BG: Record<Slot, string> = { user: '#1e3a5f', reply: '#7a5c1e', tool: '#221d33' }
export const DEFAULT_FG = '#e6e6e6' // only used as the fade target when text has no color of its own
const SLOTS: Slot[] = ['user', 'reply', 'tool']

// accepts #rgb / #rrggbb, returns #rrggbb lowercase
export function parseHex(s: string): string | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (!m) return undefined
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

// alpha 100 = the color itself, 0 = the color behind it (a terminal cell has no real alpha)
export function blend(hex: string, behind: string, alpha: number): string {
  const a = rgb(hex), b = rgb(behind)
  return `#${a.map((v, i) => Math.round(v * alpha / 100 + b[i] * (100 - alpha) / 100).toString(16).padStart(2, '0')).join('')}`
}

export type Parsed =
  | { ok: true; show: true }
  | { ok: true; show?: false; slot?: Slot; tint: Tint | null } // slot absent = every slot; tint null = reset
  | { ok: false; error: string }

export function parseArgs(args: string, kind: 'bg' | 'fg'): Parsed {
  const slots = kind === 'bg' ? SLOTS : SLOTS.filter(s => s !== 'tool')
  const usage = `Usage: /message-colors:${kind} <${slots.join('|')}> <#hex> [alpha 0-100%]  |  <slot> reset  |  reset  |  (no args = show)`
  const t = args.trim().split(/\s+/).filter(Boolean)
  if (!t.length) return { ok: true, show: true }
  if (t[0] === 'reset' && t.length === 1) return { ok: true, tint: null }
  const slot = t[0] as Slot
  if (!slots.includes(slot)) return { ok: false, error: `Unknown target "${t[0]}". ${usage}` }
  if (t[1] === 'reset' && t.length === 2) return { ok: true, slot, tint: null }
  const hex = t[1] && parseHex(t[1])
  if (!hex) return { ok: false, error: `Bad color "${t[1] ?? ''}" (use #rgb or #rrggbb). ${usage}` }
  let alpha = 100
  if (t[2] !== undefined) {
    const m = /^(\d{1,3})%?$/.exec(t[2])
    if (!m || +m[1] > 100 || t.length > 3) return { ok: false, error: `Bad alpha "${t.slice(2).join(' ')}" (0-100). ${usage}` }
    alpha = +m[1]
  }
  return { ok: true, slot, tint: { hex, alpha } }
}

// what a slot is drawn with after the settings are applied
export function resolve(settings: Settings, slot: Slot): { bg: string; fg?: string } {
  const s = settings[slot]
  const bg = s?.bg ? blend(s.bg.hex, TERMINAL_BG, s.bg.alpha) : DEFAULT_BG[slot]
  const fg = s?.fg ? blend(s.fg.hex, bg, s.fg.alpha) : undefined
  return { bg, fg }
}

export function apply(settings: Settings, kind: 'bg' | 'fg', slot: Slot | undefined, tint: Tint | null): Settings {
  const next: Settings = { ...settings }
  for (const s of slot ? [slot] : SLOTS) {
    if (kind === 'fg' && s === 'tool') continue
    const cur = { ...next[s] }
    if (tint) cur[kind] = tint
    else delete cur[kind]
    next[s] = cur
  }
  return next
}

export function describe(settings: Settings): string {
  const fmt = (t?: Tint) => (t ? `${t.hex}${t.alpha < 100 ? ` ${t.alpha}%` : ''}` : 'default')
  return SLOTS.map(s => `${s.padEnd(6)} bg ${fmt(settings[s]?.bg)}${s === 'tool' ? '' : `, fg ${fmt(settings[s]?.fg)}`}`).join('\n')
}
