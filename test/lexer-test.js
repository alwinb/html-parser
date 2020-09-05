const log = console.log.bind (console)
const { Lexer, tags, chunks, printState } = require ('../lib')

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

//*
var sample =`
<a href = foo >test<!-- foo --></bar>`
pr (sample)
//*/

// Multiple writes
//*
var l = new Lexer
l.write ('<span hr')
l.write ('n href="foo">')
l.end ('<!--comment >')

log (l.state)
for (let x of l.read ())
  log (x, l.state)
//*/