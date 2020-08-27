const log = console.log.bind (console)
const { chunks, printState } = require ('../lib')

log (chunks)

//*
// Test
// ====

function pr (input) {
  let stream = chunks (input)
  log (printState (stream.state))
  for (let x of stream) {
    log (x)
    log (printState (stream.state))
  }
}

var sample =`
<!-- -->`
pr (sample)
//*/