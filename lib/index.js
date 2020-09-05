const { assign } = Object
const log = console.log.bind (console)

const html = require ('./lexer')
assign (html, require ('./tokens'))
assign (html,  require ('./parser'))

function tags (str) {
  return html.TokenBuilder.build (html.chunks (str))
}

function Parser () {
  const t = new html.TokenBuilder ()
  const p = new html.TreeBuilder ()
  this.parse = function parse (str) {
    t.start (); p.start ()
    for (let x of html.chunks (str)) {
      t.write (x)
      p.writeev (t.readAll (str))
    }
    return p.document
  }
}

html.tags = tags
html.Parser = Parser
module.exports = html