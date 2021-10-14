const log = console.log.bind (console)
import { Lexer, tokens, chunks } from '../lib/index.js'
const { typeName, stateInfo } = Lexer

// Test
// ====

function pr (input) {
  if (input.length < 100)
    log (input, '\n'+input.split('').map(_=>'=').join(''))
  let stream = chunks (input)
  log (stateInfo (stream.state), '\n\n')
  for (let [t, v] of stream) {
    log ([typeName (t), v])
    log (stateInfo (stream.state), '\n\n')
  }

  log (input, '\n\nTokens\n========')
  stream = tokens (input)
  log (stateInfo (stream.state), '\n\n')
  for (let [t,v] of stream) {
    log ([typeName (t), v])
    log (stateInfo (stream.state), '\n\n')
  }
}

//*
var sample =`
<a href = foo >test<!-- foo --!></bar>`
// var sample = `data<!-->data`
// var sample = `data<!---!>comment`
var sample = `<script>//</script>`
var sample = `<!DOCTYPE html x>text`
var sample = `<z/0  <>`
var sample = '<a a=aa`>'
var sample = `<h a='&COPY'>`
var sample = `<!----->` // FIXME
var sample = `<br>bar</br><i>Italic</i>`
var sample = `<path/>`
var sample = `<br>bar</br><i foo=1>Italic</i foo> &amp; <b a=" bar" > `

pr (sample)
//*/

// Multiple writes
//*
log ('\n\nMultiple writes\n========')

var l = new Lexer
l.write ('<span hr')
l.write ('n href="foo">')
l.end ('<!--comment >')

// log (l.state)
for (let [t,v] of l.read ()) {
  log ([typeName(t), v])
  // log (stateInfo (l.state), stateInfo (l.state), '\n\n')
}
//*/