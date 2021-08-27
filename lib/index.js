const { assign, defineProperty:define } = Object
const log = console.log.bind (console)

const html = { 
  version: '0.10.0-dev-1',
  TreeBuilder: require ('./treebuilder'),
  Director: require ('./director'),
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

function Parser (options) {
  const p = new html.Director (options)

  this.parse = function parse (str) {
    p.reset ()
    p.write (str)
    p.end ()
    return p.document
  }
}

html.parse = input => new Parser () .parse (input)
html.tokens = tokens
html.Parser = Parser
html.chunks = chunks
module.exports = html

// log (html)