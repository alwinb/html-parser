const log = console.log.bind (console)
const { tokenName, Lexer, tags, chunks, printState } = require ('../lib')

// Test
// ====


function pr (input) {
  if (input.length < 100)
    log (input, '\n'+input.split('').map(_=>'=').join(''))
  let stream = chunks (input)
  log (printState (stream.state), '\n\n')
  for (let [t, v] of stream) {
    log ([tokenName (t), v])
    log (printState (stream.state), '\n\n')
  }

  log (input, '\n\nTokens\n========')
  stream = tags (input)
  log (printState (stream.state), '\n\n')
  for (let x of stream) {
    log (x)
    log (printState (stream.state), '\n\n')
  }
}

//*
var sample =`
<a href = foo >test<!-- foo --!></bar>`
// var sample = `data<!-->data`
// var sample = `data<!---!>comment`

pr (sample)




/*/

// Multiple writes
//*
log ('\n\nMultiple writes\n========')

var l = new Lexer
l.write ('<span hr')
l.write ('n href="foo">')
l.end ('<!--comment >')

log (l.state)
for (let [t,v] of l.read ()) {
  log ([tokenName(t), v])
  log (printState (l.state), _printState (l.state), '\n\n')
}
//*/