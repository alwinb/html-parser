const log = console.log.bind (console)
const { entries } = Object
const {
  elements:E, categories:C,
  defaultInfo, elementInfo, boundarySets, defaultBoundarySet,
  rules, defaultRule } = require ('../lib/schema')


// TODO also list default

log ('\n// Elements\n// --------\n')

log ('const elements = {', )
for (let [k,v] of entries (E)) {
  const r = []
  for (let x in elementInfo)
    if (elementInfo[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')

log ('\n\n// Element Categories\n// ------------------\n')

log ('const categories = {', )
for (let [k,v] of entries (C)) {
  const r = []
  for (let x in elementInfo)
    if (elementInfo[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')


