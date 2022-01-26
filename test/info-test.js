import { E, C, otherKind, printKind } from '../lib/categories.js'
const { entries } = Object
const log = console.log.bind (console)


// TODO also list default

for (let k in E)
  log ((k+':').padEnd (12), printKind (E[k]))


log ('\n// Elements\n// --------\n')

log ('const elements = {', )
for (let [k,v] of entries (E)) {
  const r = []
  for (let x in E)
    if (E[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')

log ('\n\n// Element Categories\n// ------------------\n')

log ('const categories = {', )
for (let [k,v] of entries (C)) if (k[0] !== '_') {
  const r = []
  for (let x in C)
    if (C[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')


