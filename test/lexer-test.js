const log = console.log.bind (console)
const { tokenName, Lexer, tokens, chunks, stateInfo } = require ('../lib')

// Test
// ====

function pr (input) {
  if (input.length < 100)
    log (input, '\n'+input.split('').map(_=>'=').join(''))
  let stream = chunks (input)
  log (stateInfo (stream.state), '\n\n')
  for (let [t, v] of stream) {
    log ([tokenName (t), v])
    log (stateInfo (stream.state), '\n\n')
  }

  log (input, '\n\nTokens\n========')
  stream = tokens (input)
  log (stateInfo (stream.state), '\n\n')
  for (let x of stream) {
    log (x)
    log (stateInfo (stream.state), '\n\n')
  }
}

//*
var sample =`
<a href = foo >test<!-- foo --!></bar>`
// var sample = `data<!-->data`
// var sample = `data<!---!>comment`
var sample = `<script>//</script>`

pr (sample)
//*/

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
  log (stateInfo (l.state), stateInfo (l.state), '\n\n')
}
//*/