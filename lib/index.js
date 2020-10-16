const { assign } = Object
const log = console.log.bind (console)

const html = require ('./lexer')
assign (html, require ('./tokens'))
assign (html,  require ('./parser'))

function* _tags (input, l) {
  const b = new html.TokenBuilder
  const chunks = l.write (input) .end () .read ()
  for (let x of chunks) {
    yield* b.write (x).readAll ()
  }
  yield* b.end ().readAll ()
}

function tags (input) {
  const l = new html.Lexer
  const stream = _tags (input, l)
  return Object.defineProperty (stream, 'state', { get: $=> l.state })
}

function Parser () {
  const l = new html.Lexer ()
  const t = new html.TokenBuilder ()
  const p = new html.TreeBuilder (this)

  this.parse = function parse (str) {
    l.restart (); t.restart (); p.restart (); 
    for (let x of l.write (str) .end () .batchRead (32)) {
      t.batchWrite (x)
      p.batchWrite (t.readAll ())
    }
    return p.document
  }
}

html.tags = tags
html.Parser = Parser
module.exports = html