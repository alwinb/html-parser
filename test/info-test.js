import { C, printKind } from '../lib/categories.js'
const { entries } = Object
const log = console.log.bind (console)


log ('\n\n// Element info\n// ------------------\n')

log ('{', )
for (let [k,v] of entries (C)) if (k[0] !== '_') {
  const r = []
  for (let x in C)
    if (C[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')


