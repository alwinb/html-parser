const log = console.log.bind (console)
const { stateNames, Lexer, tags, chunks, printState, tokenName } = require ('../lib')

// Test
// ====

function pr (input) {
  if (input.length < 100)
    log (input, '\n'+input.split('').map(_=>'=').join(''))
  let stream = chunks (input)
  log (printState (stream.state))
  for (let [t, v] of stream) {
    log ([tokenName (t), v], '\n', printState(stream.state))
  }

  log ('\ntokens\n========')
  stream = tags (input)
  for (let x of stream) {
    log ([tokenName (x[0]), x[1]])
    //log (x)
    //log (printState (stream.state))
  }
}

//*
var sample =`
<a href = foo >test<!-- foo --!></bar>`
pr (sample)
//*/

// Multiple writes
//*
var l = new Lexer
l.write ('<span hr')
l.write ('n href="foo">')
l.end ('<!--comment >')

log (l.state)
for (let [t,v] of l.read ())
  log ([tokenName (t), v], l.state)
//*/