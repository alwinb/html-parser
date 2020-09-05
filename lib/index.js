const { assign } = Object
const log = console.log.bind (console)

const html = require ('./lexer')
assign (html, require ('./tokens'))
assign (html,  require ('./parser'))

function tags (str) {
  return html.TokenBuilder.build (html.chunks (str))
}

function Parser () {
  const l = new html.Lexer ()
  const t = new html.TokenBuilder ()
  const p = new html.TreeBuilder ()

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