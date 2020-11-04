const log = console.log.bind (console)
const { entries } = Object
const {
  elements:E, categories:C, boundaries:B,
  defaultInfo, info:elementInfo, boundarySets, defaultBoundarySet,
  rules, defaultRule } = require ('../lib/schema')


// TODO also list default

log ('\n\nElements\n================')

for (let [k,v] of entries (E)) {
  log ('\n'+k+'\n--------')
  for (let x in elementInfo)
    if (elementInfo[x] & v) log (x)
}

log ('\n\nElement Categories\n================')

for (let [k,v] of entries (C)) {
  log ('\n'+k+'\n--------')
  for (let x in elementInfo)
    if (elementInfo[x] & v) log (x)
}


log ('\n\nElement Boundaries\n================')

for (let [k,v] of entries (B)) {
  log ('\n'+k+'-boundary\n--------')
  for (let x in elementInfo)
    if (elementInfo[x] & v) log (x)
}

