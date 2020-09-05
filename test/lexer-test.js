const log = console.log.bind (console)
const { tags, chunks, printState } = require ('../lib')

log (chunks)

//*
// Test
// ====

function pr (input) {
  if (input.length < 100)
    log (input, '\n'+input.split('').map(_=>'=').join(''))
  let stream = chunks (input)
  log (printState (stream.state))
  for (let x of stream) {
    log (x)
    log (printState (stream.state))
  }

  log ('\ntokens\n========')
  stream = tags (input)
  for (let x of stream) {
    log (x)
    //log (printState (stream.state))
  }
}

var sample =`
<a href = foo >test<!-- foo -->`
pr (sample)
//*/