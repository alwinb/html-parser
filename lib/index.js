const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

const html = { 
  TreeBuilder: require ('./parser'),
  Lexer: require ('./lexer'),
  TokenBuilder: require ('./tokens'),
  schema: require ('./schema'),
}

function* _tokens (input, l) {
  const b = new html.TokenBuilder
  const chunks = l.write (input) .end () .read ()
  for (let x of chunks) {
    yield* b.write (x).readAll ()
  }
  yield* b.end ().readAll ()
}

function tokens (input) {
  const l = new html.Lexer ()
  const stream = _tokens (input, l)
  return define (stream, 'state', { get: $=> l.state })
}

function chunks (input) {
  const l = new html.Lexer ()
  const stream = l.write (input) .end () .read ()
  return define (stream, 'state', { get: $=> l.state })
}

function Parser () {
  const l = new html.Lexer ()
  const t = new html.TokenBuilder ()
  const p = new html.TreeBuilder (this)

  this.parse = function parse (str) {
    l.reset (); t.reset (); p.reset (); 
    for (let x of l.write (str) .end () .batchRead (32)) {
      t.batchWrite (x)
      p.batchWrite (t.readAll ())
    }
    p.end ()
    return p.document
  }
}

html.parse = input => new Parser () .parse (input)
html.tokens = tokens
html.Parser = Parser
html.chunks = chunks
module.exports = html

log (html)