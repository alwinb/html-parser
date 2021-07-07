const log = console.log.bind (console)
const { entries } = Object
const {
  elements:E, tagNameSets:C,
  defaultInfo, elementInfo, printInfo, 
  rules, defaultRule } = require ('../lib/schema')


// TODO also list default

for (let k in elementInfo)
  log ((k+':').padEnd (12), printInfo(elementInfo[k]))


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
for (let [k,v] of entries (C)) if (k[0] !== '_') {
  const r = []
  for (let x in elementInfo)
    if (elementInfo[x] & v) r.push (x)
  log ('  ' + k + ': `' + r.sort () .join (' ') + '`,')
}
log ('}')


