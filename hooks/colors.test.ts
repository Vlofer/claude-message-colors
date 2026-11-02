// run: node hooks/colors.test.ts
import assert from 'node:assert/strict'
import { apply, blend, parseArgs, parseHex, resolve } from './colors.ts'

assert.equal(parseHex('#ABC'), '#aabbcc')
assert.equal(parseHex('red'), undefined)
assert.equal(blend('#ffffff', '#000000', 50), '#808080')
assert.equal(blend('#123456', '#000000', 100), '#123456')
assert.equal(blend('#123456', '#0c0c0c', 0), '#0c0c0c')

assert.deepEqual(parseArgs('', 'bg'), { ok: true, show: true })
assert.deepEqual(parseArgs('reply #2a4d2a 70%', 'bg'), { ok: true, slot: 'reply', tint: { hex: '#2a4d2a', alpha: 70 } })
assert.deepEqual(parseArgs('user reset', 'fg'), { ok: true, slot: 'user', tint: null })
assert.deepEqual(parseArgs('reset', 'bg'), { ok: true, tint: null })
assert.equal(parseArgs('tool #fff', 'fg').ok, false) // tool text color is not possible
assert.equal(parseArgs('user blue', 'bg').ok, false)
assert.equal(parseArgs('user #fff 101', 'bg').ok, false)
assert.equal(parseArgs('user #fff 50% x', 'bg').ok, false)

let s = apply({}, 'bg', 'tool', { hex: '#ff0000', alpha: 100 })
assert.equal(resolve(s, 'tool').bg, '#ff0000')
assert.equal(resolve(s, 'user').bg, '#1e3a5f') // untouched slot keeps its default
s = apply(s, 'fg', undefined, { hex: '#ffffff', alpha: 100 }) // no slot = every slot that has text color
assert.equal(resolve(s, 'user').fg, '#ffffff')
assert.equal(resolve(s, 'tool').fg, undefined)
s = apply(s, 'bg', undefined, null)
assert.equal(resolve(s, 'tool').bg, '#221d33')
console.log('colors.test: ok')
